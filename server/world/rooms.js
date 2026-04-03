import { customAlphabet } from "nanoid";

import { applyPlayerState, createChatMessage, createPlayer, createSystemChatMessage } from "./players.js";
import { normalizeVector3, normalizeQuaternion, toFiniteNumber, clampNumber } from "../util/index.js";

const rooms = new Map(); // map roomIds to room objects - to get what players are in each room + additional metadata
const socketToRoomId = new Map(); // map socketIds to RoomIds - to get what rooms each socket belongs to

const ROOM_ID_LENGTH = 8;

const MAX_MESSAGES_PER_ROOM = 50;
const OBJECT_ID_MAX_LENGTH = 64;

const DEFAULT_OBJECT_POSITION = Object.freeze([0, 0, 0]);
const DEFAULT_OBJECT_QUATERNION = Object.freeze([0, 0, 0, 1]);
const DEFAULT_OBJECT_VELOCITY = Object.freeze([0, 0, 0]);

// note that if we add/change movable world objects later, update this server allowlist to match
const DEFAULT_WORLD_LOUNGE_CHAIR_GROUP_COUNT = 2;
const DEFAULT_WORLD_LOUNGE_CHAIR_ROW_COUNT = 2;
const DEFAULT_WORLD_LOUNGE_CHAIR_COUNT_PER_ROW = 3;
const DEFAULT_WORLD_PLAY_AREA_SOCCER_COUNT = 5;
const DEFAULT_WORLD_DINING_CHAIR_COUNT = 4;

// watch together constants
const WATCH_AUTOPLAY_LEAD_MS = 1000
const MAX_WATCH_QUEUE_ITEMS = 100;
const WATCH_VIDEO_ID_MAX_LENGTH = 16;
const WATCH_TEXT_FIELD_MAX_LENGTH = 256;
const WATCH_URL_FIELD_MAX_LENGTH = 512;
const WATCH_PLAYBACK_RATE_MIN = 0.25;
const WATCH_PLAYBACK_RATE_MAX = 2;

const roomIdGenerator = customAlphabet("abcdefghijkmnopqrstuvwxyz23456789", ROOM_ID_LENGTH); // note that this excludes capital letters

const createRoomId = () => {
    return roomIdGenerator();
};

const getRoomIdForSocket = (socketId) => {
    return socketToRoomId.get(socketId) ?? null;
};

// mark the room as recently changed, called after player join, leave, player state updates, chat message added...
// useful if we plan to expire empty / inactive rooms
const touchRoom = (room) => {
    room.updatedAt = new Date().toISOString();
    return room;
};

const buildDefaultWorldAllowedObjectIds = () => {
    const allowedObjectIds = new Set([
        "cabana-coffee-table-0",
        "cabana-lounge-chair-0",
        "cabana-lounge-chair-1",
        "cabana-lounge-chair-2",
        "lounge-coffee-table-0",
        "lounge-coffee-table-1",
    ]);

    for (let index = 0; index < DEFAULT_WORLD_PLAY_AREA_SOCCER_COUNT; index++) {
        allowedObjectIds.add(`play-area-soccer-${index}`);
    }

    for (let index = 0; index < DEFAULT_WORLD_DINING_CHAIR_COUNT; index++) {
        allowedObjectIds.add(`lounge-dining-set-chair-${index}`);
    }

    for (let groupIndex = 0; groupIndex < DEFAULT_WORLD_LOUNGE_CHAIR_GROUP_COUNT; groupIndex++) {
        for (let rowIndex = 0; rowIndex < DEFAULT_WORLD_LOUNGE_CHAIR_ROW_COUNT; rowIndex++) {
            for (let chairIndex = 0; chairIndex < DEFAULT_WORLD_LOUNGE_CHAIR_COUNT_PER_ROW; chairIndex += 1) {
                allowedObjectIds.add(`lounge-chair-section-${groupIndex}-${rowIndex}-${chairIndex}`);
            }
        }
    }

    return allowedObjectIds;
};

const ALLOWED_OBJECT_IDS_BY_WORLD_TYPE = {
    default: buildDefaultWorldAllowedObjectIds(),
    rooftop: buildDefaultWorldAllowedObjectIds(),
};

const getAllowedObjectIdsForWorldType = (worldType) => {
    const safeWorldType = String(worldType ?? "").trim();
    return ALLOWED_OBJECT_IDS_BY_WORLD_TYPE[safeWorldType] ?? null;
};

const sanitizeObjectId = (value) => {
    // this is to prevent clients from sending huge objectId strings that coudl waste memory in room.objects keys
    return String(value ?? "").trim().slice(0, OBJECT_ID_MAX_LENGTH);
};

const createObjectState = ({ id, position, quaternion, linvel, angvel }) => {
    return {
        id,
        position: normalizeVector3(position, DEFAULT_OBJECT_POSITION),
        quaternion: normalizeQuaternion(quaternion, DEFAULT_OBJECT_QUATERNION),
        linvel: normalizeVector3(linvel, DEFAULT_OBJECT_VELOCITY), // default to 0 linear velocity in units/s
        angvel: normalizeVector3(angvel, DEFAULT_OBJECT_VELOCITY), // default to 0 angular velocity around each axis in radians/second
        updatedAt: new Date().toISOString(),
    };
};

const applyObjectState = (objectState, nextObjectState = {}) => {
    if (nextObjectState.position !== undefined) {
        objectState.position = normalizeVector3(nextObjectState.position, objectState.position ?? DEFAULT_OBJECT_POSITION);
    }

    if (nextObjectState.quaternion !== undefined) {
        objectState.quaternion = normalizeQuaternion(nextObjectState.quaternion, objectState.quaternion ?? DEFAULT_OBJECT_QUATERNION);
    }

    if (nextObjectState.linvel !== undefined) {
        objectState.linvel = normalizeVector3(nextObjectState.linvel, objectState.linvel ?? DEFAULT_OBJECT_VELOCITY);
    }

    if (nextObjectState.angvel !== undefined) {
        objectState.angvel = normalizeVector3(nextObjectState.angvel, objectState.angvel ?? DEFAULT_OBJECT_VELOCITY);
    }

    objectState.updatedAt = new Date().toISOString();
    return objectState;
};

const sanitizeWatchText = (value, maxLength = WATCH_TEXT_FIELD_MAX_LENGTH) => {
    return String(value ?? "").trim().slice(0, maxLength);
};

const sanitizeWatchPlaybackStatus = (value, fallback = "paused") => {
    const safeStatus = String(value ?? "").trim().toLowerCase();
    if (safeStatus === "playing" || safeStatus === "paused") {
        return safeStatus;
    }

    return fallback;
};

const sanitizeWatchTimeSec = (value, fallback = 0) => {
    const nextTimeSec = toFiniteNumber(value, fallback);
    return Math.max(0, nextTimeSec);
};

const sanitizeWatchPlaybackRate = (value, fallback = 1) => {
    const nextRate = toFiniteNumber(value, fallback);
    return clampNumber(nextRate, WATCH_PLAYBACK_RATE_MIN, WATCH_PLAYBACK_RATE_MAX);
};

// -1 queue index indicates there is nothing in the queue
const sanitizeQueueIndex = (value, fallback = -1) => {
    const nextIndex = Number(value);
    if (!Number.isInteger(nextIndex)) {
        return fallback;
    }

    return nextIndex;
};

const sanitizeWatchQueueVideo = (video = {}) => {
    const videoId = sanitizeWatchText(video.videoId, WATCH_VIDEO_ID_MAX_LENGTH);
    if (!videoId) {
        return null;
    }

    return {
        videoId,
        title: sanitizeWatchText(video.title, WATCH_TEXT_FIELD_MAX_LENGTH),
        channelTitle: sanitizeWatchText(video.channelTitle, WATCH_TEXT_FIELD_MAX_LENGTH),
        publishedAt: sanitizeWatchText(video.publishedAt, 64),
        thumbnailUrl: sanitizeWatchText(video.thumbnailUrl, WATCH_URL_FIELD_MAX_LENGTH),
        viewCount: sanitizeWatchText(video.viewCount, 64),
        duration: sanitizeWatchText(video.duration, 64),
    };
};

const cloneWatchQueue = (queue = []) => {
    if (!Array.isArray(queue)) {
        return [];
    }

    return queue
        .map((video) => sanitizeWatchQueueVideo(video))
        .filter(Boolean);
};


/*
 * Typical client calc:
 * If playing: effectiveTime = anchorTimeSec + ((nowMs - anchorServerTsMs) / 1000) * playbackRate
 * If paused: effectiveTime = anchorTimeSec
 */ 
const createWatchTogetherState = () => {
    const nowMs = Date.now();
    return {
        queue: [], // queue containing watchQueueVideos
        currentQueueIndex: -1,
        playbackStatus: "paused",
        playbackRate: 1,
        anchorTimeSec: 0, // authoritative video time in s at a known moment (ex: if someone seeks to 53.2, server sets anchorTimeSec = 53.2)
        anchorServerTsMs: nowMs, // server's timestamp in ms for when the anchor was recorded. Clients use this with anchorTimeSec
        version: 0, // monotonic state revision number - lets clients ignore stale/out-of-order watch:stack packets (higher versionw ins)
        updatedBy: null,
        updatedAt: new Date(nowMs).toISOString(),
    };
};

const cloneWatchTogetherState = (watchTogether) => {
    const fallbackState = createWatchTogetherState();
    const queue = cloneWatchQueue(watchTogether?.queue ?? fallbackState.queue);
    const currentQueueIndex = sanitizeQueueIndex(watchTogether?.currentQueueIndex, -1);
    const safeQueueIndex = queue.length === 0
        ? -1
        : clampNumber(currentQueueIndex, 0, queue.length - 1);

    return {
        queue,
        currentQueueIndex: safeQueueIndex,
        playbackStatus: sanitizeWatchPlaybackStatus(watchTogether?.playbackStatus, fallbackState.playbackStatus),
        playbackRate: sanitizeWatchPlaybackRate(watchTogether?.playbackRate, fallbackState.playbackRate),
        anchorTimeSec: sanitizeWatchTimeSec(watchTogether?.anchorTimeSec, fallbackState.anchorTimeSec),
        anchorServerTsMs: toFiniteNumber(watchTogether?.anchorServerTsMs, fallbackState.anchorServerTsMs),
        version: Math.max(0, toFiniteNumber(watchTogether?.version, fallbackState.version)),
        updatedBy: watchTogether?.updatedBy ? String(watchTogether.updatedBy) : null,
        updatedAt: sanitizeWatchText(watchTogether?.updatedAt, 64) || fallbackState.updatedAt,
    };
};

// clone before getting watch together state because it avoids shared-reference bugs by ensuring mutations happen on a fresh safe object
// also keeps outbound state isolated from internal mutable references
const getWatchTogetherState = (room) => {
    if (!room.watchTogether) {
        room.watchTogether = createWatchTogetherState();
    }

    // if we want to future proof object mutation bugs 
    // else {
    //     room.watchTogether = cloneWatchTogetherState(room.watchTogether);
    // }

    return room.watchTogether;
};

// applies mutation function on room watchTogether state then sanitizes and updates metadata
// also adds a version attribute which is used client side to ensure the most up to date state
const applyWatchMutation = (room, socketId, mutate, { refreshAnchorServerTs = true } = {}) => {
    const watchTogether = getWatchTogetherState(room);
    mutate(watchTogether);

    const nowMs = Date.now();
    watchTogether.version = Math.max(0, toFiniteNumber(watchTogether.version, 0)) + 1; // default to 0 if initially null / undefined
    watchTogether.updatedBy = socketId;
    if (refreshAnchorServerTs) {
        watchTogether.anchorServerTsMs = nowMs;
    }
    watchTogether.updatedAt = new Date(nowMs).toISOString();

    // keep queue/index coherent after every command
    if (watchTogether.queue.length === 0) {
        watchTogether.currentQueueIndex = -1;
        watchTogether.playbackStatus = "paused";
        watchTogether.anchorTimeSec = 0;
    } else {
        watchTogether.currentQueueIndex = clampNumber(
            sanitizeQueueIndex(watchTogether.currentQueueIndex, 0),
            0,
            watchTogether.queue.length - 1
        );
        watchTogether.playbackStatus = sanitizeWatchPlaybackStatus(watchTogether.playbackStatus, "paused");
        watchTogether.playbackRate = sanitizeWatchPlaybackRate(watchTogether.playbackRate, 1);
        watchTogether.anchorTimeSec = sanitizeWatchTimeSec(watchTogether.anchorTimeSec, 0);
    }

    touchRoom(room);
    return cloneWatchTogetherState(watchTogether);
};

const appendRoomMessage = (room, messageObj) => {
    room.messages.push(messageObj);

    // only maintain the last 50 messages in the room
    if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
        room.messages.shift();
    }

    touchRoom(room);
    return messageObj;
};

// make the room object able to be converted to a valid JSON
const serializeRoom = (room) => {
    return {
        id: room.id,
        worldType: room.worldType,
        hostSocketId: room.hostSocketId,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        players: Array.from(room.players.values()), // room.players is a map of player ids to player objects
        objects: Array.from(room.objects.values()), // room.objects is a map of physical object ids to physical object objects
        messages: [...room.messages], // copy with spread operator - messages is an array of message objects. Earlier elements are the oldest messages
        watchTogether: cloneWatchTogetherState(room.watchTogether),
    };
};

export const getRoomSnapshot = (roomId) => {
    const room = rooms.get(roomId) ?? null;
    return room ? serializeRoom(room) : null;
};

export const roomExists = (roomId) => {
    const safeRoomId = String(roomId ?? "").trim();
    if (!safeRoomId) {
        return false;
    }

    return rooms.has(safeRoomId);
}

/**
 * Creates a new room with a generated invite code and registers the given, creating
 * socket as both the room host and the first player.
 * @param {{ socketId: string, playerName: string, worldType?: string }} params
 * @returns {{ roomId: string, player: object, room: object }}
 */
export const createRoom = ({ socketId, playerName, worldType = "default" }) => {
    let roomId = createRoomId();

    // to prevent collisions
    while (rooms.has(roomId)) {
        roomId = createRoomId();
    }

    const now = new Date().toISOString();
    const newRoom = {
        id: roomId,
        worldType: String(worldType ?? "default").trim() || "default",
        hostSocketId: socketId,
        createdAt: now,
        updatedAt: now,
        players: new Map(), // map mapping playerIds (which are socketIds right now) to player objects
        objects: new Map(), // gets populated only when a client emits object:update
        messages: [], // chat history across allplayers
        watchTogether: createWatchTogetherState(),
    };

    const createdPlayer = createPlayer({ id: socketId, name: playerName });
    newRoom.players.set(socketId, createdPlayer);

    rooms.set(roomId, newRoom);
    socketToRoomId.set(socketId, roomId);

    const systemMessage = createSystemChatMessage(`${createdPlayer.name} created the room.`)
    appendRoomMessage(newRoom, systemMessage);

    // return info about created room (with created player as sole player)
    return {
        createdPlayer,
        room: serializeRoom(newRoom), // need to serialize map since client expects plain arrays/objects
    };
};

// update room object to include new player
export const joinRoom = ({ roomId, socketId, playerName }) => {
    const room = rooms.get(roomId) ?? null;
    if (!room) {
        throw new Error("Room not found.");
    }

    if (room.players.has(socketId)) {
        const existingPlayer = room.players.get(socketId);
        return {
            player: existingPlayer,
            room: serializeRoom(room),
            isNewPlayer: false,
        };
    }

    const player = createPlayer({ id: socketId, name: playerName });
    room.players.set(socketId, player);
    socketToRoomId.set(socketId, roomId);
    const joinSystemMessage = appendRoomMessage(room, createSystemChatMessage(`${player.name} has joined.`));

    return {
        player,
        systemMessage: joinSystemMessage,
        room: serializeRoom(room),
        isNewPlayer: true,
    };
};

export const leaveRoom = (socketId) => {
    const roomId = getRoomIdForSocket(socketId);
    if (!roomId) { // if no room id, that means this socket isn't attached to any room
        return null;
    }

    socketToRoomId.delete(socketId); // delete this client socket from the room
    
    const room = rooms.get(roomId) ?? null;
    if (!room) { // no room exists for the corresponding room id of the socket - only happens when room record is gone / inconsistent - handling stale mapping
        return {
            roomId,
            roomDeleted: true,
            removedPlayerId: socketId,
            nextHostSocketId: null,
        };
    }

    const leavingPlayerName = room.players.get(socketId)?.name ?? "A player";

    // delete the current socket from the room's players
    room.players.delete(socketId);

    // if the player that just left was the host, transfer host ownership to another player
    const prevHostSocketId = room.hostSocketId;
    if (room.hostSocketId === socketId) {
        const nextHost = room.players.keys().next(); // next() returns an object like: { value: ..., done: false }
        room.hostSocketId = nextHost.done ? null : nextHost.value;
    }

    console.log(`${socketId} left the room, room size is ${room.players.size}, host is ${room.hostSocketId}`)

    if (room.players.size === 0) {
        rooms.delete(roomId);
        return {
            roomId,
            roomDeleted: true,
            removedPlayerId: socketId,
            nextHostSocketId: null,
            systemMessage: null,
        };
    }

    const nextHostPlayerName = room.hostSocketId ? room.players.get(room.hostSocketId)?.name : "";
    const hostChanged = room.hostSocketId !== prevHostSocketId
    const statusMessage = nextHostPlayerName && hostChanged
        ? `${leavingPlayerName} has left. ${nextHostPlayerName} is the new host.`
        : `${leavingPlayerName} has left.`;
    const leaveSystemMessage = appendRoomMessage(room, createSystemChatMessage(statusMessage));

    // if we made it here, there are still players left in the room but the current player succesfully left
    return {
        roomId,
        roomDeleted: false, 
        removedPlayerId: socketId,
        nextHostSocketId: room.hostSocketId,
        systemMessage: leaveSystemMessage,
    };
};

export const updatePlayerState = (socketId, nextState) => {
    const roomId = getRoomIdForSocket(socketId);
    if (!roomId) {
        throw new Error("Socket is not assigned to a room.");
    }

    const room = rooms.get(roomId) ?? null;
    if (!room) {
        throw new Error("Room not found.");
    }

    const player = room.players.get(socketId);
    if (!player) {
        throw new Error("Player not found.");
    }

    applyPlayerState(player, nextState);
    touchRoom(room);

    return {
        roomId,
        player: { ...player },
    };
};

export const updateWorldObjectState = (socketId, nextObjectState = {}) => {
    const roomId = getRoomIdForSocket(socketId);
    if (!roomId) {
        throw new Error("Socket is not assigned to a room.");
    }

    const room = rooms.get(roomId) ?? null;
    if (!room) {
        throw new Error("Room not found.");
    }

    const objectId = sanitizeObjectId(nextObjectState.objectId);
    if (!objectId) {
        throw new Error("Object ID is required.");
    }

    // this is so that malicious clients can no longer create arbitrary fake object IDs and grow room.objects unbounded
    const allowedObjectIds = getAllowedObjectIdsForWorldType(room.worldType);
    if (!allowedObjectIds || !allowedObjectIds.has(objectId)) {
        throw new Error(`Object ID "${objectId}" is not allowed for world "${room.worldType}".`);
    }

    const existingObject = room.objects.get(objectId);
    if (!existingObject) { // if the object hasn't been registered yet
        room.objects.set(objectId, createObjectState({
            id: objectId,
            position: nextObjectState.position,
            quaternion: nextObjectState.quaternion,
            linvel: nextObjectState.linvel,
            angvel: nextObjectState.angvel,
        }));
    } else { // if the object is already registered
        applyObjectState(existingObject, nextObjectState);
    }

    touchRoom(room);
    const updatedObject = room.objects.get(objectId);

    return {
        roomId,
        object: { ...updatedObject },
    };
};

export const addChatMessage = (socketId, text) => {
    const roomId = getRoomIdForSocket(socketId);
    if (!roomId) {
        throw new Error("Socket is not assigned to a room.");
    }

    const room = rooms.get(roomId) ?? null;
    if (!room) {
        throw new Error("Room not found.");
    }

    const player = room.players.get(socketId);
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

    return {
        roomId,
        message: messageObj,
        player: { ...player },
    };
};

const normalizeWatchCommandType = (value) => {
    const safeType = String(value ?? "").trim().toLowerCase();

    if (safeType === "play") return "playback:play";
    if (safeType === "pause") return "playback:pause";
    if (safeType === "seek") return "playback:seek";
    if (safeType === "rate") return "playback:rate";
    if (safeType === "queue:add" || safeType === "enqueue") return "queue:add";
    if (safeType === "queue:remove" || safeType === "queue:delete") return "queue:remove";
    if (safeType === "queue:set-index" || safeType === "queue:setindex") return "queue:set-index";
    if (safeType === "queue:clear") return "queue:clear";

    return safeType;
};

export const applyWatchTogetherCommand = (socketId, commandPayload = {}) => {
    const roomId = getRoomIdForSocket(socketId);
    if (!roomId) {
        throw new Error("Socket is not assigned to a room.");
    }

    const room = rooms.get(roomId) ?? null;
    if (!room) {
        throw new Error("Room not found.");
    }

    if (!room.players.has(socketId)) {
        throw new Error("Player not found.");
    }

    const commandType = normalizeWatchCommandType(commandPayload.type);
    if (!commandType) {
        throw new Error("Watch command type is required.");
    }

    // we don't want queue:add, for example, to update playback time by setting anchorServerTsMs, since it sometimes doesn't update anchorTimeSec
    const shouldRefreshAnchorServerTs = commandType.startsWith("playback:")
        || commandType === "queue:set-index";

    const nextWatchState = applyWatchMutation(room, socketId, (watchTogether) => {
        switch (commandType) {
            case "queue:add": {
                const rawVideo = commandPayload.video ?? commandPayload.item;
                const video = sanitizeWatchQueueVideo(rawVideo);
                if (!video) {
                    throw new Error("A valid video is required.");
                }

                if (watchTogether.queue.length >= MAX_WATCH_QUEUE_ITEMS) {
                    throw new Error(`Queue limit reached (${MAX_WATCH_QUEUE_ITEMS} videos).`);
                }

                watchTogether.queue.push(video);
                if (watchTogether.currentQueueIndex < 0) {
                    watchTogether.currentQueueIndex = 0;
                    watchTogether.playbackStatus = "playing";
                    watchTogether.anchorTimeSec = 0;
                    watchTogether.anchorServerTsMs = Date.now() + WATCH_AUTOPLAY_LEAD_MS; // 1000 is the short server lead-in for the first queued item, since it needs time to load client side
                }
                return;
            }

            case "queue:remove": {
                const indexToRemove = sanitizeQueueIndex(commandPayload.queueIndex ?? commandPayload.index, -1);
                if (indexToRemove < 0 || indexToRemove >= watchTogether.queue.length) {
                    throw new Error("Queue index is out of bounds.");
                }

                watchTogether.queue.splice(indexToRemove, 1);

                if (watchTogether.queue.length === 0) {
                    watchTogether.currentQueueIndex = -1;
                    watchTogether.playbackStatus = "paused";
                    watchTogether.anchorTimeSec = 0;
                    return;
                }

                if (watchTogether.currentQueueIndex === indexToRemove) {
                    watchTogether.currentQueueIndex = Math.min(indexToRemove, watchTogether.queue.length - 1);
                    watchTogether.playbackStatus = "paused";
                    watchTogether.anchorTimeSec = 0;
                    return;
                }

                // if the watchTogether state index is > indexToRemove, we need to shift our current queue index backwards by 1
                if (watchTogether.currentQueueIndex > indexToRemove) {
                    watchTogether.currentQueueIndex -= 1;
                }
                return;
            }

            case "queue:set-index": {
                if (watchTogether.queue.length === 0) {
                    throw new Error("Queue is empty.");
                }

                const index = sanitizeQueueIndex(commandPayload.queueIndex ?? commandPayload.index, -1);
                if (index < 0 || index >= watchTogether.queue.length) {
                    throw new Error("Queue index is out of bounds.");
                }

                watchTogether.currentQueueIndex = index;
                // allowing timeSec in payload is for flexibility, but in reality anchorTimeSec should always be set to 0 on queue index change
                watchTogether.anchorTimeSec = sanitizeWatchTimeSec(commandPayload.timeSec, 0);
                watchTogether.playbackStatus = "playing"; // always set playbackStatus to playing every time we select a new video in the queue
                return;
            }

            // we currently don't have support in the frontend for this
            case "queue:clear": {
                watchTogether.queue = [];
                watchTogether.currentQueueIndex = -1;
                watchTogether.playbackStatus = "paused";
                watchTogether.anchorTimeSec = 0;
                return;
            }

            case "playback:play": {
                if (watchTogether.queue.length === 0) {
                    throw new Error("Queue is empty.");
                }

                watchTogether.playbackStatus = "playing";

                // anchorTimeSec and playbackRate can be set as well for client simplicity, although it's probably not practical / required
                watchTogether.anchorTimeSec = sanitizeWatchTimeSec(commandPayload.timeSec, watchTogether.anchorTimeSec);
                if (commandPayload.playbackRate !== undefined) {
                    watchTogether.playbackRate = sanitizeWatchPlaybackRate(
                        commandPayload.playbackRate,
                        watchTogether.playbackRate
                    );
                }
                return;
            }

            // its important pass in timeSec here because otherwise, server keeps previous anchorTimeSec, which is often older (like when play started)
            // this implies everyone will pause at stale / different times
            case "playback:pause": {
                watchTogether.playbackStatus = "paused";
                watchTogether.anchorTimeSec = sanitizeWatchTimeSec(commandPayload.timeSec, watchTogether.anchorTimeSec);
                return;
            }

            // main function here is to change anchorTimeSec
            case "playback:seek": {
                watchTogether.anchorTimeSec = sanitizeWatchTimeSec(commandPayload.timeSec, watchTogether.anchorTimeSec);
                if (commandPayload.playbackStatus !== undefined) {
                    watchTogether.playbackStatus = sanitizeWatchPlaybackStatus(
                        commandPayload.playbackStatus,
                        watchTogether.playbackStatus
                    );
                }
                return;
            }

            case "playback:rate": {
                watchTogether.playbackRate = sanitizeWatchPlaybackRate(
                    commandPayload.playbackRate,
                    watchTogether.playbackRate
                );

                if (commandPayload.timeSec !== undefined) {
                    watchTogether.anchorTimeSec = sanitizeWatchTimeSec(commandPayload.timeSec, watchTogether.anchorTimeSec);
                }
                return;
            }

            default:
                throw new Error(`Unsupported watch command type "${commandType}".`);
        }
    }, {
        refreshAnchorServerTs: shouldRefreshAnchorServerTs,
    });

    return {
        roomId,
        watchTogether: nextWatchState,
    };
};

// export internal helper
export const getRoomIdBySocket = getRoomIdForSocket;
