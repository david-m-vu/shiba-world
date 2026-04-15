import { applyPlayerState, createChatMessage, createPlayer, createSystemChatMessage } from "./players.js";
import { roomIdGenerator } from "../util/index.js";
import {
    touchRoom,
    getAllowedObjectIdsForWorldType,
    sanitizeObjectId,
    createObjectState,
    applyObjectState,
    createWatchTogetherState,
    appendRoomMessage,
    serializeRoom,
    applyWatchCommandToRoom
} from "./roomStateHelpers.js";
import { MAX_PLAYERS_PER_ROOM } from "../constants/roomConstants.js";

const rooms = new Map(); // map roomIds to room objects - to get what players are in each room + additional metadata
const socketToRoomId = new Map(); // map socketIds to RoomIds - to get what rooms each socket belongs to

const createRoomId = () => {
    return roomIdGenerator();
};

const getRoomIdForSocket = (socketId) => {
    return socketToRoomId.get(socketId) ?? null;
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

export const getRoomPublicStatus = (roomId) => {
    const safeRoomId = String(roomId ?? "").trim();
    if (!safeRoomId) {
        return null;
    }

    const room = rooms.get(safeRoomId) ?? null;
    if (!room) {
        return null;
    }

    const maxPlayers = room.maxPlayers ?? MAX_PLAYERS_PER_ROOM;
    const playerCount = room.players.size;

    return {
        roomId: room.id,
        playerCount,
        maxPlayers,
        isFull: playerCount >= maxPlayers,
    };
};

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
        maxPlayers: MAX_PLAYERS_PER_ROOM
    };

    const createdPlayer = createPlayer({ id: socketId, name: playerName });
    newRoom.players.set(socketId, createdPlayer);

    rooms.set(roomId, newRoom);
    socketToRoomId.set(socketId, roomId);

    const systemMessage = createSystemChatMessage(`${createdPlayer.name} created the room.`, { systemType: "create" })
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

    // if room to join is full, send error message to client
    const maxPlayers = room.maxPlayers ?? MAX_PLAYERS_PER_ROOM
    if (room.players.size >= maxPlayers) {
        throw new Error(`Room is full. Maximum ${maxPlayers} players allowed.`);
    }

    const player = createPlayer({ id: socketId, name: playerName });
    room.players.set(socketId, player);
    socketToRoomId.set(socketId, roomId);
    const joinSystemMessage = appendRoomMessage(
        room,
        createSystemChatMessage(`${player.name} has joined.`, { systemType: "join" })
    );

    return {
        player,
        systemMessage: joinSystemMessage,
        room: serializeRoom(room),
        isNewPlayer: true,
    };
};

const removeSocketFromCurrentRoom = (socketId) => {
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
    const leaveSystemMessage = appendRoomMessage(
        room,
        createSystemChatMessage(statusMessage, { systemType: "leave" })
    );

    // if we made it here, there are still players left in the room but the current player succesfully left
    return {
        roomId,
        roomDeleted: false, 
        removedPlayerId: socketId,
        nextHostSocketId: room.hostSocketId,
        systemMessage: leaveSystemMessage,
    };
};

export const leaveRoom = (socketId) => {
    return removeSocketFromCurrentRoom(socketId);
};

// similar to joinRoom, but also leaves the current room if the socket is in one before joining the given, new one
export const moveSocketToRoom = ({ roomId, socketId, playerName }) => {
    const targetRoom = rooms.get(roomId) ?? null;
    if (!targetRoom) {
        throw new Error("Room not found.");
    }

    if (targetRoom.players.has(socketId)) {
        const existingPlayer = targetRoom.players.get(socketId);
        return {
            departureObj: null,
            player: existingPlayer,
            room: serializeRoom(targetRoom),
            isNewPlayer: false,
        };
    }

    const maxPlayers = targetRoom.maxPlayers ?? MAX_PLAYERS_PER_ROOM;
    if (targetRoom.players.size >= maxPlayers) {
        throw new Error(`Room is full. Maximum ${maxPlayers} players allowed.`);
    }

    const departureObj = removeSocketFromCurrentRoom(socketId);

    const player = createPlayer({ id: socketId, name: playerName });
    targetRoom.players.set(socketId, player);
    socketToRoomId.set(socketId, roomId);
    const joinSystemMessage = appendRoomMessage(
        targetRoom,
        createSystemChatMessage(`${player.name} has joined.`, { systemType: "join" })
    );

    return {
        departureObj,
        player,
        systemMessage: joinSystemMessage,
        room: serializeRoom(targetRoom),
        isNewPlayer: true,
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

    // TODO: do we really need to return player here?
    return {
        roomId,
        message: messageObj,
        player: { ...player },
    };
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

    const nextWatchState = applyWatchCommandToRoom(room, socketId, commandPayload);

    return {
        roomId,
        watchTogether: nextWatchState,
    };
};

// export internal helper
export const getRoomIdBySocket = getRoomIdForSocket;
