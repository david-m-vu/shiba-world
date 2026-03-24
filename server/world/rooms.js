import { customAlphabet } from "nanoid";

import { applyPlayerState, createChatMessage, createPlayer, createSystemChatMessage } from "./players.js";

const rooms = new Map(); // map roomIds to room objects - to get what players are in each room + additional metadata
const socketToRoomId = new Map(); // map socketIds to RoomIds - to get what rooms each socket belongs to

const MAX_MESSAGES_PER_ROOM = 50;
const OBJECT_ID_MAX_LENGTH = 64;
const ROOM_ID_LENGTH = 8;
const roomIdGenerator = customAlphabet("abcdefghijkmnopqrstuvwxyz23456789", ROOM_ID_LENGTH); // note that this excludes capital letters

const DEFAULT_OBJECT_POSITION = Object.freeze([0, 0, 0]);
const DEFAULT_OBJECT_QUATERNION = Object.freeze([0, 0, 0, 1]);
const DEFAULT_OBJECT_VELOCITY = Object.freeze([0, 0, 0]);

// note that if we add/change movable world objects later, update this server allowlist to match
const DEFAULT_WORLD_LOUNGE_CHAIR_GROUP_COUNT = 2;
const DEFAULT_WORLD_LOUNGE_CHAIR_ROW_COUNT = 2;
const DEFAULT_WORLD_LOUNGE_CHAIR_COUNT_PER_ROW = 3;
const DEFAULT_WORLD_PLAY_AREA_SOCCER_COUNT = 5;
const DEFAULT_WORLD_DINING_CHAIR_COUNT = 4;

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

const normalizeVector3 = (value, fallback = DEFAULT_OBJECT_POSITION) => {
    if (!Array.isArray(value) || value.length !== 3) {
        return [...fallback];
    }

    return value.map((entry, index) => {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : fallback[index];
    });
};

const normalizeQuaternion = (value, fallback = DEFAULT_OBJECT_QUATERNION) => {
    if (!Array.isArray(value) || value.length !== 4) {
        return [...fallback];
    }

    const normalized = value.map((entry, index) => {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : fallback[index];
    });
    const length = Math.hypot(normalized[0], normalized[1], normalized[2], normalized[3]);

    // a zero quaternion is invalid for rotation, and this is to avoid dividing by zero
    if (length < 0.000001) {
        return [...fallback];
    }

    return normalized.map((entry) => entry / length);
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

    console.log(`${player.name} joined room ${room.id}`)

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

    console.log(`player ${socketId} left the room, room size is ${room.players.size}, host is ${room.hostSocketId}`)

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

// export internal helper
export const getRoomIdBySocket = getRoomIdForSocket;
