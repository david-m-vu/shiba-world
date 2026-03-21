/**
 * zustand store for local settings _ multiplayer socket/room state
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createGameSocket, emitWithAck } from "../lib/socketClient.js";

const toSafeVector3 = (value, fallback = [0, 0, 0]) => {
    if (!Array.isArray(value) || value.length !== 3) {
        return [...fallback];
    }

    return value.map((entry, index) => {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : fallback[index];
    })
}

const normalizePlayer = (player = {}) => {
    return {
        id: String(player.id ?? ""),
        name: String(player.name ?? "Anonymous"),
        position: toSafeVector3(player.position, [0, 5, 0]),
        rotation: toSafeVector3(player.rotation, [0, 0, 0]),
        activeMessage: String(player.activeMessage ?? ""),
        connectedAt: player.connectedAt ?? null,
        updatedAt: player.updatedAt ?? null,
    }
}

const playersToMap = (players = []) => {
    // use object instead of map because zustand + react updates are easier, and objects serialize easily
    const nextPlayersById = {};

    players.forEach((player) => {
        const normalizedPlayer = normalizePlayer(player);
        if (!normalizedPlayer.id) {
            return;
        }

        nextPlayersById[normalizedPlayer.id] = normalizedPlayer;
    })

    return nextPlayersById;
}

const normalizeRoomState = (room = {}) => {
    const playersById = playersToMap(room.players ?? []);
    
    return {
        id: room.id ?? null,
        hostSocketId: room.hostSocketId ?? null,
        playersById,
        messages: Array.isArray(room.messages) ? room.messages : []
    }
}

const applyRoomSnapshot = (set, roomSnapshot = {}, selfPlayerId = null) => {
    const normalizedRoomState = normalizeRoomState(roomSnapshot);

    set({
        currentRoomId: normalizedRoomState.id,
        selfPlayerId,
        hostSocketId: normalizedRoomState.hostSocketId,
        playersById: normalizedRoomState.playersById,
        messages: normalizedRoomState.messages,
        roomErrorMessage: ""
    })
}

const clearRoomState = (set) => {
    set({
        localPlayerName: "",
        currentRoomId: null,
        selfPlayerId: null,
        hostSocketId: null,
        playersById: {},
        messages: [],
        cameraLockMode: false,
    })
}

const bindSocketListeners = (set, get, socket) => {
    // NOTE: there is another connect listener in initializeSocket
    // this one is a long-lived listener for the socket's whole lifetime, and should run on initial connect and on every reconnect
    // the other one is a one-shot promise gate - "wait until this specific connection attempt succeeds or fails before continuing"
    // if a connect event fires, both handlers run
    socket.on("connect", () => {
        set({
            socketConnected: true,
            socketId: socket.id,
            socketErrorMessage: "",
        });
    });

    socket.on("disconnect", (reason) => {
        set({
            socketConnected: false,
            socketId: null,
            socketErrorMessage: `Disconnected from server (${reason}).`
        })

        clearRoomState(set);
    })

    socket.on("connect_error", (error) => {
        const message = error instanceof Error ? error.message : "Socket connection failed.";
        set({
            socketConnected: false,
            socketErrorMessage: message,
        })
    })

    // TODO: this might not be necessary
    // socket.on("connected:ready", (payload = {}) => {
    //     if (payload.socketId) {
    //         set({ socketId: payload.socketId });
    //     }
    // })

    socket.on("room:error", (payload = {}) => {
        const message = String(payload.message ?? "Room error.");
        set({ roomErrorMessage: message });
    })

    socket.on("player:joined", (payload = {}) => {
        const player = normalizePlayer(payload.player);
        if (!player.id) {
            return;
        }

        set((state) => ({
            playersById: {
                ...state.playersById,
                [player.id]: player,
            }
        }))
    })

    socket.on("player:left", (payload = {}) => {
        const playerId = String(payload.playerId ?? "");
        const nextHostSocketId = payload.hostSocketId ?? null;
        if (!playerId) {
            return;
        }

        set((state) => {
            const nextPlayersById = { ...state.playersById }; // need to copy because zustand state should be treated as immutable
            delete nextPlayersById[playerId];

            return {
                hostSocketId: nextHostSocketId,
                playersById: nextPlayersById,
            }
        })
    })

    socket.on("player:state", (payload = {}) => {
        const incomingPlayer = normalizePlayer(payload.player);
        if (!incomingPlayer.id) {
            return;
        }

        set((state) => {
            const previousPlayer = state.playersById[incomingPlayer.id];
            return {
                playersById: {
                    ...state.playersById,
                    [incomingPlayer.id]: previousPlayer ? {
                        ...previousPlayer,
                        ...incomingPlayer
                    } :
                    incomingPlayer
                }
            }
        })
    })

    socket.on("chat:message", (payload = {}) => {
        const message = payload.message;
        if (!message?.id) {
            return;
        }

        set((state) => {
            if (state.messages.some((entry) => entry.id === message.id)) {
                // if message already exists, leave state unchanged
                return state;
            }

            return {
                messages: [...state.messages, message]
            }
        })
    })

    // keep a single listener in-memory; listeners are cleaned when socket is replaced/disconnected
    // this socketListenersReady flag ensures bindSocketListeners(...) runs once per socket instance
    get().setSocketListenersReady(true);
}

export const useGameStore = create(
    persist(
        (set, get) => ({ // need to use get in the case where we aren't setting something. Use get when you need to read current store data outside a set updater
            // local state
            cameraLockMode: false,
            sunsetMode: true,
            voiceEnabled: false,
            soundEnabled: true,
            videoScreenEnabled: true,
            shadowsEnabled: true,
            infiniteJumpEnabled: false,
            debugModeEnabled: false,
            resetCharacterRequestId: 0,

            localPlayerName: "",
            currentRoomId: null,
            selfPlayerId: null, // technically the same as socketId for now
            hostSocketId: null,

            socket: null,
            socketId: null, // technically the same as selfPlayerId for now
            socketConnected: false,
            socketListenersReady: false,
            socketErrorMessage: "",
            roomErrorMessage: "",
            localBubbleClearTimeoutId: null,

            // synced state
            playersById: {},
            messages: [],
            

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
            toggleVideoScreenEnabled: () => {
                set((state) => ({ videoScreenEnabled: !state.videoScreenEnabled }));
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

            setSocketListenersReady: (socketListenersReady) => {
                set({ socketListenersReady })
            },

            initializeSocket: async () => {
                let socket = get().socket;

                if (!socket) {
                    socket = createGameSocket();
                    set({
                        socket,
                        socketErrorMessage: "",
                        roomErrorMessage: "",
                        socketListenersReady: false,
                    })
                }

                if(!get().socketListenersReady) {
                    // this function binds all the event handlers and also sets socketListenersReady to true, so this is only called once
                    bindSocketListeners(set, get, socket)
                }

                // if socket is already connected, we can just end here
                if (socket.connected) {
                    return socket;
                }

                await new Promise((resolve, reject) => {
                    const handleConnect = () => {
                        // clean up connect_error listener because connect already succeeded
                        socket.off("connect_error", handleConnectError);
                        resolve();
                    }

                    // NOTE: there is another connect listener in initializeSocket
                    // this one is a one-shot promise gate - "wait until this specific connection attempt succeeds or fails before continuing"
                    // the other one is a long-lived listener for the socket's whole lifetime, and should run on initial connect and on every reconnect
                    // if a connect event fires, both handlers run
                    const handleConnectError = (error) => {
                        // clean up connect because connect failed, connect_error ran
                        socket.off("connect", handleConnect);
                        const message = error instanceof Error ? error.message : "Socket connection failed.";
                        reject(new Error(message));
                    }

                    // socket.once runs only the first time that the event fires, then auto-removes itself
                    // set up connect handlers then actually connect
                    socket.once("connect", handleConnect);
                    socket.once("connect_error", handleConnectError);
                    socket.connect(); // after socket.connect() succeeds, socket.connected becomes true and socket.id is assigned by the server
                })

                return socket;
            },

            createRoom: async ({ playerName, worldType = "rooftop" } = {}) => {
                const safePlayerName = (playerName ?? "").trim();
                if (!safePlayerName) {
                    set({ roomErrorMessage: "Name is required." })
                    return { ok: false, message: "Name is required" }
                }

                try {
                    const socket = await get().initializeSocket();
                    const response = await emitWithAck(socket, "room:create", {
                        playerName: safePlayerName,
                        worldType,
                    })

                    if (!response.ok || !response.room?.id) {
                        const message= response.message ?? "Fao;ed to create room.";
                        set({ roomErrorMessage: message });
                        return { ok: false, message }
                    }

                    applyRoomSnapshot(set, response.room, response.selfPlayerId ?? null);
                    
                    set({
                        localPlayerName: safePlayerName,
                    });

                    return {
                        ok: true,
                        roomId: response.room.id,
                    }
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to create room.";
                    set({ roomErrorMessage: message });
                    return { ok: false, message }
                }
            },

            joinRoom: async ({ roomId, playerName } = {}) => {
                const safeRoomId = String(roomId ?? "").trim();
                const safePlayerName = String(playerName ?? "").trim();

                if (!safeRoomId) {
                    const message = "Room ID is required.";
                    set({ roomErrorMessage: message });
                    return { ok: false, message };
                }

                if (!safePlayerName) {
                    const message = "Name is required.";
                    set({ roomErrorMessage: message });
                    return { ok: false, message };
                }

                try {
                    // note that initializeSocket() doesn't do anything if socket instance is already created 
                    // or we're already connected
                    const socket = await get().initializeSocket();
                    const response = await emitWithAck(socket, "room:join", {
                        roomId: safeRoomId,
                        playerName: safePlayerName,
                    })

                    if (!response.ok || !response.room?.id) {
                        const message = response.message ?? "Failed to join room.";
                        set({ roomErrorMessage: message });
                        return { ok: false, message }
                    }

                    applyRoomSnapshot(set, response.room, response.selfPlayerId ?? null);
                    set({
                        localPlayerName: safePlayerName
                    })

                    return {
                        ok: true,
                        roomId: response.room.id,
                    }

                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to join room.";
                    set({ roomErrorMessage: message });
                    return { ok: false, message };
                }
            },

            // do state cleanup and emit room:leave event
            leaveRoom: async () => {
                const socket = get().socket;
                const activeTimeoutId = get().localBubbleClearTimeoutId;

                if (activeTimeoutId) {
                    window.clearTimeout(activeTimeoutId);
                }

                if (socket?.connected) {
                    try {
                        await emitWithAck(socket, "room:leave", {});
                    } catch {
                        // keep local leave behavior even if server ack fails
                    }
                }

                if (document.pointerLockElement) {
                    try {
                        document.exitPointerLock();
                    } catch {
                        // no-op
                    }
                }

                clearRoomState(set);

                set({
                    roomErrorMessage: "",
                    localBubbleClearTimeoutId: null,
                });
            },

            refreshRoomState: async () => {
                const socket = get().socket;
                if (!socket?.connected) {
                    return { ok: false, message: "Socket is not connected."};
                }

                try {
                    const response = await emitWithAck(socket, "room:state", {});
                    if (!response.ok || !response.room?.id) {
                        return { ok: false, message: "Room snapshot is unavailable."};
                    }

                    applyRoomSnapshot(set, response.room, get().selfPlayerId);
                    return { ok: true };
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to refresh room state.";
                    set({ roomErrorMessage: message });
                    return { ok: false, message };
                }
            },

            sendPlayerUpdate: ({ position, rotation, activeMessage } = {}) => {
                const socket = get().socket;
                const selfPlayerId = get().selfPlayerId;

                if (!socket?.connected || !selfPlayerId) {
                    return;
                }

                const payload = {};
                if (position !== undefined) {
                    payload.position = toSafeVector3(position, [0, 5, 0]);
                }
                if (rotation !== undefined) {
                    payload.rotation = toSafeVector3(rotation, [0, 0, 0]);
                }
                if (activeMessage !== undefined) {
                    payload.activeMessage = String(activeMessage);
                }

                socket.emit("player:update", payload);

                set((state) => {
                    const previousPlayerObj = state.playersById[selfPlayerId] ?? normalizePlayer({
                        id: selfPlayerId,
                        name: state.localPlayerName,
                    })

                    return {
                        playersById: {
                            ...state.playersById,
                            [selfPlayerId]: {
                                ...previousPlayerObj,
                                ...(payload.position ? { position: payload.position } : {}), // need to write it like this so position doesn't get nullified if given position is undefined
                                ...(payload.rotation ? { rotation: payload.rotation } : {}),
                                ...(payload.activeMessage !== undefined ? { activeMessage: payload.activeMessage } : {}),
                                updatedAt: new Date().toISOString(),
                            }
                        }
                    }
                })
            },

            sendChatMessage: async (text) => {
                const safeText = String(text ?? "").trim();
                if (!safeText) {
                    return { ok: false, message: "Message is empty"};
                }

                const socket = get().socket;
                if (!socket?.connected) {
                    return { ok: false, message: "Socket is not connected."};
                }

                try {
                    const response = await emitWithAck(socket, "chat:send", { text: safeText });
                    if (!response.ok) {
                        const message = response.message ?? "Failed to send message."; 
                        set({ roomErrorMessage: message });
                        return { ok: false, message }
                    }

                    // TODO: set response.message as cur message for local player?

                    // clear previous timeout
                    const previousTimeoutId = get().localBubbleClearTimeoutId;
                    if (previousTimeoutId) {
                        window.clearTimeout(previousTimeoutId);
                    }

                    // set new timeout for message clear
                    const timeoutId = window.setTimeout(() => {
                        get().sendPlayerUpdate({ activeMessage: "" });
                        set({ localBubbleClearTimeoutId: null });
                    }, 4500);

                    set({ localBubbleClearTimeoutId: timeoutId });
                    return { ok: true };
                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to send message.";
                    set({ roomErrorMessage: message });
                    return { ok: false, message };
                }
            }
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
