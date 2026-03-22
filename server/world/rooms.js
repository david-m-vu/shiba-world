import { customAlphabet } from "nanoid";

import { applyPlayerState, createChatMessage, createPlayer } from "./players.js";

const rooms = new Map(); // map roomIds to room objects - to get what players are in each room + additional metadata
const socketToRoomId = new Map(); // map socketIds to RoomIds - to get what rooms each socket belongs to

const MAX_MESSAGES_PER_ROOM = 50;
const OBJECT_ID_MAX_LENGTH = 64;
const ROOM_ID_LENGTH = 8;
const roomIdGenerator = customAlphabet("abcdefghijkmnopqrstuvwxyz23456789", ROOM_ID_LENGTH); // note that this excludes capital letters

const DEFAULT_OBJECT_POSITION = Object.freeze([0, 0, 0]);
const DEFAULT_OBJECT_QUATERNION = Object.freeze([0, 0, 0, 1]);
const DEFAULT_OBJECT_VELOCITY = Object.freeze([0, 0, 0]);

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

const applyObjectState = (objectState, nextState = {}) => {
    if (nextState.position !== undefined) {
        objectState.position = normalizeVector3(nextState.position, objectState.position ?? DEFAULT_OBJECT_POSITION);
    }

    if (nextState.quaternion !== undefined) {
        objectState.quaternion = normalizeQuaternion(nextState.quaternion, objectState.quaternion ?? DEFAULT_OBJECT_QUATERNION);
    }

    if (nextState.linvel !== undefined) {
        objectState.linvel = normalizeVector3(nextState.linvel, objectState.linvel ?? DEFAULT_OBJECT_VELOCITY);
    }

    if (nextState.angvel !== undefined) {
        objectState.angvel = normalizeVector3(nextState.angvel, objectState.angvel ?? DEFAULT_OBJECT_VELOCITY);
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
    touchRoom(room);

    console.log(`${player.name} joined room ${room.id}`)

    return {
        player,
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

    // delete the current socket from the room's players
    room.players.delete(socketId);

    // if the player that just left was the host, transfer host ownership to another player
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
        };
    }

    touchRoom(room);

    // if we made it here, there are still players left in the room but the current player succesfully left
    return {
        roomId,
        roomDeleted: false, 
        removedPlayerId: socketId,
        nextHostSocketId: room.hostSocketId,
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

export const updateWorldObjectState = (socketId, nextState = {}) => {
    const roomId = getRoomIdForSocket(socketId);
    if (!roomId) {
        throw new Error("Socket is not assigned to a room.");
    }

    const room = rooms.get(roomId) ?? null;
    if (!room) {
        throw new Error("Room not found.");
    }

    const objectId = sanitizeObjectId(nextState.objectId);
    if (!objectId) {
        throw new Error("Object ID is required.");
    }

    const existingObject = room.objects.get(objectId);
    if (!existingObject) { // if the object hasn't been registered yet
        room.objects.set(objectId, createObjectState({
            id: objectId,
            position: nextState.position,
            quaternion: nextState.quaternion,
            linvel: nextState.linvel,
            angvel: nextState.angvel,
        }));
    } else { // if the object is already registered
        applyObjectState(existingObject, nextState);
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
    room.messages.push(messageObj);

    // only maintain the last 50 messages in the room
    if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
        room.messages.shift();
    }

    touchRoom(room);

    return {
        roomId,
        message: messageObj,
        player: { ...player },
    };
};

// export internal helper
export const getRoomIdBySocket = getRoomIdForSocket;
