import {
    addChatMessage,
    applyWatchTogetherCommand,
    createRoom,
    getRoomIdBySocket,
    getRoomSnapshot,
    joinRoom,
    leaveRoom,
    roomExists,
    updatePlayerState,
    updateWorldObjectState,
} from "../rooms.js";

/**
 * In-memory RoomStore adapter backed by the current `server/world/rooms.js` implementation.
 * This keeps behavior unchanged while allowing callers to depend on a RoomStore contract.
 */
export const createInMemoryRoomStore = () => {
    return {
        roomExists: async (roomId) => roomExists(roomId),
        getRoomSnapshot: async (roomId) => getRoomSnapshot(roomId),
        createRoom: async (params) => createRoom(params),
        joinRoom: async (params) => joinRoom(params),
        leaveRoom: async (socketId) => leaveRoom(socketId),
        updatePlayerState: async (socketId, nextState) => updatePlayerState(socketId, nextState),
        updateWorldObjectState: async (socketId, nextObjectState) => updateWorldObjectState(socketId, nextObjectState),
        addChatMessage: async (socketId, text) => addChatMessage(socketId, text),
        applyWatchTogetherCommand: async (socketId, commandPayload) => applyWatchTogetherCommand(socketId, commandPayload),
        getRoomIdBySocket: async (socketId) => getRoomIdBySocket(socketId),
        close: async () => {},
    };
};
