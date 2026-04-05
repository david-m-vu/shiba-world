import { randomUUID } from "node:crypto";

import { createClient } from "redis";

import { applyPlayerState, createChatMessage, createPlayer, createSystemChatMessage } from "../players.js";
import { roomIdGenerator } from "../../util/index.js";
import {
    touchRoom,
    sanitizeObjectId,
    getAllowedObjectIdsForWorldType,
    createObjectState,
    applyObjectState,
    sanitizeWatchText,
    createWatchTogetherState,
    cloneWatchTogetherState,
    appendRoomMessage,
    serializeRoom,
} from "../roomStateHelpers.js";
import { applyWatchCommandToRoom } from "../watchTogetherCommands.js";

const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

// takes plain serialized room data (parsed JSON Object from Redis) and build it into runtime room shape
// rebuilds players and objects as Maps
// normalizes / sanitizes room fields (worldType, timestamps, watch state)
// reconstructs object state safely with createObjectState
// returns a room object
const hydrateRoom = (serializedRoom) => {
    if (!serializedRoom || typeof serializedRoom !== "object") {
        return null;
    }

    const id = String(serializedRoom.id ?? "").trim();
    if (!id) {
        return null;
    }

    // rebuild players array as map
    const players = new Map();
    // since JSON serializes Map data to arrays
    if (Array.isArray(serializedRoom.players)) {
        for (const player of serializedRoom.players) {
            const playerId = String(player?.id ?? "").trim();
            if (!playerId) {
                continue;
            }
            players.set(playerId, { ...player });
        }
    }

    // rebuild objects array as map
    const objects = new Map();
    if (Array.isArray(serializedRoom.objects)) {
        for (const objectState of serializedRoom.objects) {
            const objectId = String(objectState?.id ?? "").trim();
            if (!objectId) {
                continue;
            }

            // rebuild trusted runtime state from untrusted serialized data
            objects.set(objectId, createObjectState({
                id: objectId,
                position: objectState.position,
                quaternion: objectState.quaternion,
                linvel: objectState.linvel,
                angvel: objectState.angvel,
            }));

            const object = objects.get(objectId);
            object.updatedAt = sanitizeWatchText(objectState.updatedAt, 64) || object.updatedAt;
        }
    }

    return {
        id,
        worldType: String(serializedRoom.worldType ?? "default").trim() || "default",
        hostSocketId: serializedRoom.hostSocketId ? String(serializedRoom.hostSocketId) : null,
        createdAt: sanitizeWatchText(serializedRoom.createdAt, 64) || new Date().toISOString(),
        updatedAt: sanitizeWatchText(serializedRoom.updatedAt, 64) || new Date().toISOString(),
        players,
        objects,
        messages: Array.isArray(serializedRoom.messages) ? [...serializedRoom.messages] : [],
        watchTogether: cloneWatchTogetherState(serializedRoom.watchTogether),
    };
};

// convert JSON stringified rawValue into object then into trusted runtime room object
const parseRoomSnapshot = (rawValue) => {
    if (!rawValue) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawValue);
        return hydrateRoom(parsed);
    } catch {
        return null;
    }
};

export const createRedisRoomStore = async ({
    redisUrl,
    keyPrefix = "shiba-world",
    roomTtlSeconds = 86400,
    socketRoomTtlSeconds = roomTtlSeconds,
    lockTtlMs = 3000,
    lockAcquireTimeoutMs = 1500,
    lockRetryDelayMs = 25,
} = {}) => {
    const safeRedisUrl = String(redisUrl ?? "").trim();
    if (!safeRedisUrl) {
        throw new Error("Redis URL is required to create RedisRoomStore.");
    }

    const client = createClient({
        url: safeRedisUrl,
    });

    client.on("error", (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Redis RoomStore error: ${message}`);
    });

    // open network connection from node process to the redis server
    await client.connect();

    /*
     * stuff involved in setting up interactions with the redis store 
     */
    const roomKey = (roomId) => `${keyPrefix}:room:${roomId}`; // stores the full serialized room state
    const roomLockKey = (roomId) => `${keyPrefix}:room-lock:${roomId}`; // stores the temporary lock token for room-level write locking (to avoid concurrent mutation races)
    const socketRoomKey = (socketId) => `${keyPrefix}:socket-room:${socketId}`; // stores mapping from a socketto its current room, so we can quickly resolve "which room is this socket in?". Replaces socketToRoomId map
    
    const safeRoomTtlSeconds = Number.isFinite(Number(roomTtlSeconds)) && Number(roomTtlSeconds) > 0
        ? Math.floor(Number(roomTtlSeconds))
        : 86400;

    const safeSocketRoomTtlSeconds = Number.isFinite(Number(socketRoomTtlSeconds)) && Number(socketRoomTtlSeconds) > 0
        ? Math.floor(Number(socketRoomTtlSeconds))
        : safeRoomTtlSeconds;

    const safeLockTtlMs = Number.isFinite(Number(lockTtlMs)) && Number(lockTtlMs) > 0
        ? Math.floor(Number(lockTtlMs))
        : 3000;

    const setSocketRoomMapping = async (socketId, roomId) => {
        await client.set(socketRoomKey(socketId), roomId, {
            EX: safeSocketRoomTtlSeconds,
        });
    };

    const deleteSocketRoomMapping = async (socketId) => {
        await client.del(socketRoomKey(socketId));
    };

    const getRoomIdForSocket = async (socketId) => {
        const safeSocketId = String(socketId ?? "").trim();
        if (!safeSocketId) {
            return null;
        }

        const storedRoomId = await client.get(socketRoomKey(safeSocketId));
        return storedRoomId ? String(storedRoomId) : null;
    };

    const getRoomById = async (roomId) => {
        const safeRoomId = String(roomId ?? "").trim();
        if (!safeRoomId) {
            return null;
        }

        const rawRoom = await client.get(roomKey(safeRoomId));
        return parseRoomSnapshot(rawRoom);
    };

    const saveRoom = async (room) => {
        await client.set(roomKey(room.id), JSON.stringify(serializeRoom(room)), {
            EX: safeRoomTtlSeconds,
        });
    };

    const releaseLock = async (lockKey, lockToken) => {
        // lua makes indices start at 1
        // if the lock key value matches the given lockToken, delete the lock key, otherwise do nothing
        // deleting the lock key is equivalent to releasing the lock withRoomLock only sets if key does not already exist
        const releaseScript = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
        try {
            await client.eval(releaseScript, {
                keys: [lockKey],
                arguments: [lockToken],
            });
        } catch {
            // no-op
        }
    };

    // returns true if renew lock successful
    const renewLock = async (lockKey, lockToken) => {
        // only extend ttl if we still own the lock
        // PEXPIRE sets (or resets) a key's TTL in milliseconds
        const renewScript = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) else return 0 end";
        try {
            const result = await client.eval(renewScript, {
                keys: [lockKey],
                arguments: [lockToken, String(safeLockTtlMs)],
            });
            return Number(result) === 1;
        } catch {
            return false;
        }
    };

    // we use locks even though javascript is single threaded because we can have concurrent writes
    // through multiple server instances, multiple overlappingasync handlers in one instance, multiple clients hitting the same room simultaneously
    // acquire this lock when a method needs to read room state, mutate it, AND write it back.
    // if lock acquisition fails, throws an error
    const withRoomLock = async (roomId, operation) => {
        const safeRoomId = String(roomId ?? "").trim();
        if (!safeRoomId) {
            throw new Error("Room ID is required.");
        }

        const lockKey = roomLockKey(safeRoomId);
        const lockToken = randomUUID(); // this token acts as the about-to-be id of the acquirer of the lock if claimed
        // deadline for trying to acquire the room lock. Keeps retrying lock acquisition until this timestamp
        const lockDeadline = Date.now() + lockAcquireTimeoutMs; 

        while (Date.now() < lockDeadline) {
            const result = await client.set(lockKey, lockToken, {
                NX: true, // set only if key does not already exist (acquire lock only if free)
                PX: safeLockTtlMs, // set key expiration in ms (auto-release after TTL)
            });

            if (result === "OK") {
                break;
            }

            // wait lockRetryDelayMs before trying to reacquire the lock
            await sleep(lockRetryDelayMs);
        }

        const lockOwner = await client.get(lockKey);
        if (lockOwner !== lockToken) {
            throw new Error("Failed to acquire room lock.");
        }

        let stopRenewal = false;
        let lockLost = false;
        const renewIntervalMs = Math.max(250, Math.floor(safeLockTtlMs / 3));
        
        // this loop runs forever until process holding lock is finished or process dies / crashes
        const runRenewLoop = async () => {
            while (!stopRenewal && !lockLost) {
                await sleep(renewIntervalMs);
                if (stopRenewal || lockLost) {
                    break;
                }

                const renewed = await renewLock(lockKey, lockToken);
                // if renew fails, you can no longer prove you still exclusively own the lock because the TTL may have expired
                // and another writer may already hold it. COntinuing mutation would risk concurrent writes / races, so the code aborts
                if (!renewed) {
                    lockLost = true;
                    break;
                }
            }
        };

        // calling runRenewLoop without immediate await starts it in the background, so the main flow can continue into operation()
        const renewPromise = runRenewLoop();
        const assertLockHeld = () => {
            if (lockLost) {
                throw new Error("Room lock was lost during mutation.");
            }
        };

        // if we're here, we've acquired the lock
        try {
            const result = await operation({ assertLockHeld }); // call assertLockHeld before critical writes to room state
            assertLockHeld(); // make sure lock was held during the mutation, and right before returning
            return result;
        } finally { // finally code still runs after returns
            stopRenewal = true;
            await renewPromise; // await renewPromise to let the while loop exit after stopRenewal = true. Avoids overlap/racy lock operations during cleanup
            await releaseLock(lockKey, lockToken);
        }
    };

    /*
     * room read and write helper functions
     */
    const createRoomId = () => {
        return roomIdGenerator();
    };

    const roomExists = async (roomId) => {
        const safeRoomId = String(roomId ?? "").trim();
        if (!safeRoomId) {
            return false;
        }

        const result = await client.exists(roomKey(safeRoomId));
        return result === 1;
    };

    const getRoomSnapshot = async (roomId) => {
        const room = await getRoomById(roomId);
        return room ? serializeRoom(room) : null;
    };

    const createRoomForSocket = async ({ socketId, playerName, worldType = "default" }) => {
        const safeSocketId = String(socketId ?? "").trim();
        if (!safeSocketId) {
            throw new Error("Socket ID is required.");
        }

        const now = new Date().toISOString();
        const createdPlayer = createPlayer({ id: safeSocketId, name: playerName });

        // create a new room where the given player / socket is the host
        const createSerializedRoomForId = (roomId) => {
            const room = {
                id: roomId,
                worldType: String(worldType ?? "default").trim() || "default",
                hostSocketId: safeSocketId,
                createdAt: now,
                updatedAt: now,
                players: new Map(),
                objects: new Map(),
                messages: [],
                watchTogether: createWatchTogetherState(),
            };

            room.players.set(safeSocketId, createdPlayer);
            appendRoomMessage(room, createSystemChatMessage(`${createdPlayer.name} created the room.`));
            return serializeRoom(room);
        };

        let createdRoomSnapshot = null;
        for (let attempt = 0; attempt < 20; attempt += 1) {
            const nextRoomId = createRoomId();
            const snapshot = createSerializedRoomForId(nextRoomId);
            const result = await client.set(roomKey(nextRoomId), JSON.stringify(snapshot), {
                NX: true, // make sure nextRoomId isn't already taken
                EX: safeRoomTtlSeconds, // ex is the same as px but expires after N seconds instead of milliseconds
            });

            if (result === "OK") {
                createdRoomSnapshot = snapshot;
                break;
            }
        }

        if (!createdRoomSnapshot) {
            throw new Error("Failed to create room. Please try again.");
        }

        await setSocketRoomMapping(safeSocketId, createdRoomSnapshot.id);

        return {
            createdPlayer,
            room: createdRoomSnapshot,
        };
    };

    const joinRoomById = async ({ roomId, socketId, playerName }) => {
        const safeRoomId = String(roomId ?? "").trim();
        const safeSocketId = String(socketId ?? "").trim();

        if (!safeRoomId) {
            throw new Error("Room ID is required.");
        }

        if (!safeSocketId) {
            throw new Error("Socket ID is required.");
        }

        return withRoomLock(safeRoomId, async ({ assertLockHeld }) => {
            const room = await getRoomById(safeRoomId);
            if (!room) {
                throw new Error("Room not found.");
            }

            if (room.players.has(safeSocketId)) {
                const existingPlayer = room.players.get(safeSocketId);
                return {
                    player: existingPlayer,
                    room: serializeRoom(room),
                    isNewPlayer: false,
                };
            }

            const player = createPlayer({ id: safeSocketId, name: playerName });
            room.players.set(safeSocketId, player);
            const joinSystemMessage = appendRoomMessage(room, createSystemChatMessage(`${player.name} has joined.`));
            assertLockHeld(); // make sure we have the lock before saving room because ttl might have expired while we had the lock acquired
            await saveRoom(room);
            assertLockHeld(); // so we don't create a mapping for a join whose locked room mutation may no longer be trustworthy
            await setSocketRoomMapping(safeSocketId, safeRoomId);

            return {
                player,
                systemMessage: joinSystemMessage,
                room: serializeRoom(room),
                isNewPlayer: true,
            };
        });
    };

    const leaveRoomBySocket = async (socketId) => {
        const safeSocketId = String(socketId ?? "").trim();
        if (!safeSocketId) {
            return null;
        }

        const assignedRoomId = await getRoomIdForSocket(safeSocketId);
        if (!assignedRoomId) {
            return null;
        }

        // run room mutation first, then socket mapping cleanup in redis
        // this reduces orphan risk during failures because room record is the source of truth
        const departureObj = await withRoomLock(assignedRoomId, async ({ assertLockHeld }) => {
            const room = await getRoomById(assignedRoomId);
            if (!room) {
                return {
                    roomId: assignedRoomId,
                    roomDeleted: true,
                    removedPlayerId: safeSocketId,
                    nextHostSocketId: null,
                };
            }

            const leavingPlayerName = room.players.get(safeSocketId)?.name ?? "A player";
            room.players.delete(safeSocketId);

            const prevHostSocketId = room.hostSocketId;
            if (room.hostSocketId === safeSocketId) {
                const nextHost = room.players.keys().next();
                room.hostSocketId = nextHost.done ? null : nextHost.value;
            }

            if (room.players.size === 0) {
                // if delete ever fails, TTL is the fallback that eventually expires the room key when activity stops
                assertLockHeld(); // make sure we have lock before we delete the room (ex: another writer might have joined / updated room after taking the lock if expired)
                await client.del(roomKey(assignedRoomId));
                return {
                    roomId: assignedRoomId,
                    roomDeleted: true,
                    removedPlayerId: safeSocketId,
                    nextHostSocketId: null,
                    systemMessage: null,
                };
            }

            const nextHostPlayerName = room.hostSocketId ? room.players.get(room.hostSocketId)?.name : "";
            const hostChanged = room.hostSocketId !== prevHostSocketId;
            const statusMessage = nextHostPlayerName && hostChanged
                ? `${leavingPlayerName} has left. ${nextHostPlayerName} is the new host.`
                : `${leavingPlayerName} has left.`;
            const leaveSystemMessage = appendRoomMessage(room, createSystemChatMessage(statusMessage));
            assertLockHeld();
            await saveRoom(room);

            return {
                roomId: assignedRoomId,
                roomDeleted: false,
                removedPlayerId: safeSocketId,
                nextHostSocketId: room.hostSocketId,
                systemMessage: leaveSystemMessage,
            };
        });

        try {
            await deleteSocketRoomMapping(safeSocketId);
        } catch {
            // no-op; mapping will eventually expire via TTL
        }

        return departureObj;
    };

    const updatePlayerStateBySocket = async (socketId, nextState) => {
        const safeSocketId = String(socketId ?? "").trim();
        const assignedRoomId = await getRoomIdForSocket(safeSocketId);
        if (!assignedRoomId) {
            throw new Error("Socket is not assigned to a room.");
        }

        return withRoomLock(assignedRoomId, async ({ assertLockHeld }) => {
            const room = await getRoomById(assignedRoomId);
            if (!room) {
                throw new Error("Room not found.");
            }

            const player = room.players.get(safeSocketId);
            if (!player) {
                throw new Error("Player not found.");
            }

            applyPlayerState(player, nextState);
            touchRoom(room);
            assertLockHeld();
            await saveRoom(room);

            return {
                roomId: assignedRoomId,
                player: { ...player },
            };
        });
    };

    const updateWorldObjectStateBySocket = async (socketId, nextObjectState = {}) => {
        const safeSocketId = String(socketId ?? "").trim();
        const assignedRoomId = await getRoomIdForSocket(safeSocketId);
        if (!assignedRoomId) {
            throw new Error("Socket is not assigned to a room.");
        }

        return withRoomLock(assignedRoomId, async ({ assertLockHeld }) => {
            const room = await getRoomById(assignedRoomId);
            if (!room) {
                throw new Error("Room not found.");
            }

            const objectId = sanitizeObjectId(nextObjectState.objectId);
            if (!objectId) {
                throw new Error("Object ID is required.");
            }

            const allowedObjectIds = getAllowedObjectIdsForWorldType(room.worldType);
            if (!allowedObjectIds || !allowedObjectIds.has(objectId)) {
                throw new Error(`Object ID \"${objectId}\" is not allowed for world \"${room.worldType}\".`);
            }

            const existingObject = room.objects.get(objectId);
            if (!existingObject) {
                room.objects.set(objectId, createObjectState({
                    id: objectId,
                    position: nextObjectState.position,
                    quaternion: nextObjectState.quaternion,
                    linvel: nextObjectState.linvel,
                    angvel: nextObjectState.angvel,
                }));
            } else {
                applyObjectState(existingObject, nextObjectState);
            }

            touchRoom(room);
            const updatedObject = room.objects.get(objectId);
            assertLockHeld();
            await saveRoom(room);

            return {
                roomId: assignedRoomId,
                object: { ...updatedObject },
            };
        });
    };

    const addChatMessageBySocket = async (socketId, text) => {
        const safeSocketId = String(socketId ?? "").trim();
        const assignedRoomId = await getRoomIdForSocket(safeSocketId);
        if (!assignedRoomId) {
            throw new Error("Socket is not assigned to a room.");
        }

        return withRoomLock(assignedRoomId, async ({ assertLockHeld }) => {
            const room = await getRoomById(assignedRoomId);
            if (!room) {
                throw new Error("Room not found.");
            }

            const player = room.players.get(safeSocketId);
            if (!player) {
                throw new Error("Player not found.");
            }

            const messageObj = createChatMessage({
                playerId: player.id,
                playerName: player.name,
                text,
            });

            player.activeMessage = messageObj.text;
            player.updatedAt = messageObj.createdAt;
            appendRoomMessage(room, messageObj);
            assertLockHeld();
            await saveRoom(room);

            return {
                roomId: assignedRoomId,
                message: messageObj,
                player: { ...player },
            };
        });
    };

    const applyWatchTogetherCommandBySocket = async (socketId, commandPayload = {}) => {
        const safeSocketId = String(socketId ?? "").trim();
        const assignedRoomId = await getRoomIdForSocket(safeSocketId);
        if (!assignedRoomId) {
            throw new Error("Socket is not assigned to a room.");
        }

        return withRoomLock(assignedRoomId, async ({ assertLockHeld }) => {
            const room = await getRoomById(assignedRoomId);
            if (!room) {
                throw new Error("Room not found.");
            }

            if (!room.players.has(safeSocketId)) {
                throw new Error("Player not found.");
            }

            const nextWatchState = applyWatchCommandToRoom(room, safeSocketId, commandPayload);
            assertLockHeld();
            await saveRoom(room);

            return {
                roomId: assignedRoomId,
                watchTogether: nextWatchState,
            };
        });
    };

    const close = async () => {
        if (client.isOpen) {
            await client.quit(); // close redis connection after flushing/finishing pending commands
        }
    };

    return {
        roomExists,
        getRoomSnapshot,
        createRoom: createRoomForSocket,
        joinRoom: joinRoomById,
        leaveRoom: leaveRoomBySocket,
        updatePlayerState: updatePlayerStateBySocket,
        updateWorldObjectState: updateWorldObjectStateBySocket,
        addChatMessage: addChatMessageBySocket,
        applyWatchTogetherCommand: applyWatchTogetherCommandBySocket,
        getRoomIdBySocket: getRoomIdForSocket,
        close,
    };
};
