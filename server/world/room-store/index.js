import { createInMemoryRoomStore } from "./inMemoryRoomStore.js";

/** @type {import('./types.js').RoomStore} */
let roomStore = createInMemoryRoomStore();

export const getRoomStore = () => {
    return roomStore;
};

export const setRoomStore = (nextRoomStore) => {
    if (!nextRoomStore || typeof nextRoomStore !== "object") {
        throw new Error("A valid RoomStore object is required.");
    }

    const requiredMethods = [
        "roomExists",
        "getRoomPublicStatus",
        "getRoomSnapshot",
        "createRoom",
        "joinRoom",
        "leaveRoom",
        "moveSocketToRoom",
        "updatePlayerState",
        "updateWorldObjectState",
        "addChatMessage",
        "applyWatchTogetherCommand",
        "getRoomIdBySocket",
    ];

    for (const methodName of requiredMethods) {
        if (typeof nextRoomStore[methodName] !== "function") {
            throw new Error(`RoomStore is missing required method \"${methodName}\".`);
        }
    }

    // defaults to in memory room store until redis driver code sets it
    roomStore = nextRoomStore;
    return roomStore;
};
