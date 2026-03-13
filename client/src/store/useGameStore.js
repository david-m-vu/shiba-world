/**
 * zustand store for sockets, players, and messages
 */

import { create } from "zustand";

export const useGameStore = create((set) => ({
    cameraLockMode: false,
    setCameraLockMode: (cameraLockMode) => {
        set({ cameraLockMode });
    },
}))
