/**
 * zustand store for sockets, players, and messages
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const useGameStore = create(
    persist(
        (set) => ({
            cameraLockMode: false,
            sunsetMode: true,
            voiceEnabled: false,
            soundEnabled: true,
            shadowsEnabled: true,
            infiniteJumpEnabled: false,
            debugModeEnabled: false,
            resetCharacterRequestId: 0,

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
            toggleInfiniteJumpEnabled: () => {
                set((state) => ({ infiniteJumpEnabled: !state.infiniteJumpEnabled }));
            },
            toggleDebugModeEnabled: () => {
                set((state) => ({ debugModeEnabled: !state.debugModeEnabled }));
            },
            // simply updating this resetCharacterRequestId state is what triggers a position/rotation/velocity reset in MultiplayerLayer.jsx
            requestResetCharacter: () => {
                set((state) => ({ resetCharacterRequestId: state.resetCharacterRequestId + 1 }));
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
        }),

        {
            name: "shiba-world-preferences-v1", // storage key in localStorage
            storage: createJSONStorage(() => localStorage), // createJSONStorage is a zustand helper that handles JSON serialize/deserialize for persisted state - stringifies partial state obj before writing to local storage
            partialize: (state) => ({ // partial state to persist across refreshes. Persist middleware saves only this object to localStorage, not the full zustand state
                sunsetMode: state.sunsetMode,
            }),
        }
    )
);
