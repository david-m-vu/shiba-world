/**
 * zustand store for sockets, players, and messages
 */

import { create } from "zustand";

export const useGameStore = create((set) => ({
    cameraLockMode: false,
    sunsetMode: true,
    voiceEnabled: false,
    soundEnabled: true,
    shadowsEnabled: true,

    hasCreatedRoom: false,
    localPlayerName: "",
    currentRoomId: null,

    setCameraLockMode: (cameraLockMode) => {
        set({ cameraLockMode });
    },
    toggleSunsetMode: () => {
        set((state) => ({ sunsetMode: !state.sunsetMode }));
    },
    toggleVoiceEnabled: () => {
        set((state) => ({ voiceEnabled: !state.voiceEnabled }));
    },
    toggleSoundEnabled: () => {
        set((state) => ({ soundEnabled: !state.soundEnabled }));
    },
    toggleShadowsEnabled: () => {
        set((state) => ({ shadowsEnabled: !state.shadowsEnabled }));
    },

    createRoom: ({ playerName, roomId } = {}) => {
        const safePlayerName = (playerName ?? "").trim();
        if (!safePlayerName) {
            return;
        }

        // TODO: communicate with server through socket.io to create a room and get a roomId

        // generate a short random alphanumeric string - trim the 0. with slice
        // note that is not cryptographically secure, has vvariable length, and can result in collisions - this is just temporary
        const safeRoomId = (roomId ?? "").trim() || `room-${Math.random().toString(36).slice(2, 8)}`;

        set({
            hasCreatedRoom: true,
            localPlayerName: safePlayerName,
            currentRoomId: safeRoomId,
        });
    },

    leaveRoom: () => {
        set({
            hasCreatedRoom: false,
            localPlayerName: "",
            currentRoomId: null,
            cameraLockMode: false,
        });
    },
}))
