/**
 * zustand store for local settings _ multiplayer socket/room state
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createGameSocket, emitWithAck } from "../lib/socketClient.js";
import { toSafeVector3, toSafeVector4 } from "../lib/util.js";

const DEFAULT_TOAST_DURATION_MS = 5000;
const MAX_ACTIVE_TOASTS = 5;
const MAX_MESSAGES_PER_ROOM = 50;
const WATCH_PLAYBACK_RATE_MIN = 0.25;
const WATCH_PLAYBACK_RATE_MAX = 2;

let nextToastId = 0;

const createToastId = () => {
    nextToastId++;
    return `toast-${nextToastId}`;
};

const buildRoomShareLink = (roomId) => {
    const safeRoomId = String(roomId ?? "").trim();
    if (!safeRoomId) {
        return "";
    }

    const roomPath = `/rooms/${safeRoomId}`;
    if (typeof window === "undefined" || !window.location?.origin) {
        return roomPath;
    }

    return `${window.location.origin}${roomPath}`;
};

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

const normalizeObjectState = (objectState = {}) => {
    return {
        id: String(objectState.id ?? ""),
        position: toSafeVector3(objectState.position, [0, 0, 0]),
        quaternion: toSafeVector4(objectState.quaternion, [0, 0, 0, 1]),
        linvel: toSafeVector3(objectState.linvel, [0, 0, 0]),
        angvel: toSafeVector3(objectState.angvel, [0, 0, 0]),
        updatedAt: objectState.updatedAt ?? null,
    };
}

const createDefaultWatchTogetherState = () => {
    return {
        queue: [],
        currentQueueIndex: -1,
        playbackStatus: "paused",
        playbackRate: 1,
        anchorTimeSec: 0, // authoritative video time in s at a known moment (ex: if someone seeks to 53.2, server sets anchorTimeSec = 53.2)
        anchorServerTsMs: Date.now(), // server's timestamp in ms for when the anchor was recorded. Clients use this with anchorTimeSec
        version: 0, // monotonic state revision number - lets clients ignore stale/out-of-order watch:stack packets (higher versionw ins)
        updatedBy: null,
        updatedAt: null,
    };
};

const normalizeWatchQueueVideo = (video = {}) => {
    const videoId = String(video.videoId ?? "").trim();
    if (!videoId) {
        return null;
    }

    return {
        videoId,
        title: String(video.title ?? "").trim(),
        channelTitle: String(video.channelTitle ?? "").trim(),
        publishedAt: String(video.publishedAt ?? "").trim(),
        thumbnailUrl: String(video.thumbnailUrl ?? "").trim(),
        viewCount: String(video.viewCount ?? "").trim(),
        duration: String(video.duration ?? "").trim(),
    };
};

const normalizeWatchTogetherState = (watchTogether = {}) => {
    const fallback = createDefaultWatchTogetherState();
    const queue = Array.isArray(watchTogether.queue)
        ? watchTogether.queue.map((video) => normalizeWatchQueueVideo(video)).filter(Boolean)
        : [];

    const rawQueueIndex = Number(watchTogether.currentQueueIndex);
    const safeQueueIndex = queue.length === 0
        ? -1
        : Number.isInteger(rawQueueIndex)
            ? Math.max(0, Math.min(queue.length - 1, rawQueueIndex))
            : 0;

    const rawPlaybackStatus = String(watchTogether.playbackStatus ?? "").trim().toLowerCase();
    const playbackStatus = rawPlaybackStatus === "playing" ? "playing" : "paused";

    const rawPlaybackRate = Number(watchTogether.playbackRate);
    const playbackRate = Number.isFinite(rawPlaybackRate)
        ? Math.max(WATCH_PLAYBACK_RATE_MIN, Math.min(WATCH_PLAYBACK_RATE_MAX, rawPlaybackRate))
        : fallback.playbackRate;

    const rawAnchorTimeSec = Number(watchTogether.anchorTimeSec);
    const anchorTimeSec = Number.isFinite(rawAnchorTimeSec)
        ? Math.max(0, rawAnchorTimeSec)
        : fallback.anchorTimeSec;

    const rawAnchorServerTsMs = Number(watchTogether.anchorServerTsMs);
    const anchorServerTsMs = Number.isFinite(rawAnchorServerTsMs)
        ? rawAnchorServerTsMs
        : fallback.anchorServerTsMs;

    const rawVersion = Number(watchTogether.version);
    const version = Number.isFinite(rawVersion)
        ? Math.max(0, Math.floor(rawVersion))
        : fallback.version;

    return {
        queue,
        currentQueueIndex: safeQueueIndex,
        playbackStatus,
        playbackRate,
        anchorTimeSec,
        anchorServerTsMs,
        version,
        updatedBy: watchTogether.updatedBy ? String(watchTogether.updatedBy) : null,
        updatedAt: watchTogether.updatedAt ? String(watchTogether.updatedAt) : null,
    };
};

// This function normalizes each player in the players array and spreads them out in an object. 
// Returns this object
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

const objectsToMap = (objects = []) => {
    const nextObjectsById = {};

    objects.forEach((objectState) => {
        const normalizedObjectState = normalizeObjectState(objectState);
        if (!normalizedObjectState.id) {
            return;
        }

        nextObjectsById[normalizedObjectState.id] = normalizedObjectState;
    });

    return nextObjectsById;
}

const normalizeRoomState = (room = {}) => {
    const playersById = playersToMap(room.players ?? []);
    const objectsById = objectsToMap(room.objects ?? []);
    
    return {
        id: room.id ?? null,
        hostSocketId: room.hostSocketId ?? null,
        playersById,
        objectsById,
        messages: Array.isArray(room.messages)
            ? room.messages.map((message) => normalizeMessage(message)).filter((message) => message.id)
            : [],
        watchTogether: normalizeWatchTogetherState(room.watchTogether),
    }
}

const normalizeMessage = (message = {}) => {
    return {
        id: String(message.id ?? ""),
        playerId: String(message.playerId ?? ""),
        playerName: String(message.playerName ?? "Anonymous"),
        text: String(message.text ?? "").trim(),
        createdAt: message.createdAt ?? null,
        type: message.type === "system" ? "system" : "chat",
    };
};

const appendMessage = (messages = [], nextMessage) => {
    const normalizedMessage = normalizeMessage(nextMessage);
    if (!normalizedMessage.id || !normalizedMessage.text) {
        return messages;
    }

    if (messages.some((message) => message.id === normalizedMessage.id)) {
        return messages;
    }

    return [...messages, normalizedMessage].slice(-MAX_MESSAGES_PER_ROOM);
};

const applyRoomSnapshot = (set, roomSnapshot = {}, selfPlayerId = null) => {
    const normalizedRoomState = normalizeRoomState(roomSnapshot);

    set({
        currentRoomId: normalizedRoomState.id,
        selfPlayerId,
        hostSocketId: normalizedRoomState.hostSocketId,
        playersById: normalizedRoomState.playersById,
        objectsById: normalizedRoomState.objectsById,
        messages: normalizedRoomState.messages,
        watchTogether: normalizedRoomState.watchTogether,
    })
}

const clearRoomState = (set) => {
    set({
        localPlayerName: "",
        currentRoomId: null,
        selfPlayerId: null,
        hostSocketId: null,
        playersById: {},
        objectsById: {},
        messages: [],
        watchTogether: createDefaultWatchTogetherState(),
        cameraLockMode: false,
        watchTogetherOpen: false,
    })
}

const bindSocketListeners = (set, get, socket) => {
    // NOTE: there is another connect listener in initializeSocket
    // this one is a long-lived listener for the socket's whole lifetime, and should run on initial connect and on every reconnect
    // the other one is a one-shot promise gate - "wait until this specific connection attempt succeeds or fails before continuing"
    // if a connect event fires, both handlers run
    socket.on("connect", () => {
        const wasConnected = get().socketConnected;
        set({
            socketConnected: true,
            socketId: socket.id,
            socketErrorMessage: "",
        });

        // avoids noisy UI if state and socket events momentarily get out of sync
        if (!wasConnected) {
            get().pushToast("Connected to server", {
                type: "info"
            });
        }
    });

    socket.on("disconnect", (reason) => {
        set({
            socketConnected: false,
            socketId: null,
            socketErrorMessage: `Disconnected from server (${reason}).`
        })

        clearRoomState(set);
        get().pushToast(`Disconnected from server (${reason}).`, {
            type: "error"
        });
    })

    socket.on("connect_error", (error) => {
        const message = error instanceof Error ? error.message : "Socket connection failed.";
        set({
            socketConnected: false,
            socketErrorMessage: message,
        })
    })

    socket.on("room:error", (payload = {}) => {
        const message = String(payload.message ?? "Room error.");
        get().pushToast(message, {
            type: "error"
        });
    })

    socket.on("player:joined", (payload = {}) => {
        const player = normalizePlayer(payload.player);
        const selfPlayerId = get().selfPlayerId;
        if (!player.id) {
            return;
        }

        set((state) => ({
            playersById: {
                ...state.playersById,
                [player.id]: player,
            },
        }))

        if (player.id !== selfPlayerId) {
            get().pushToast(`${player.name} has joined.`, {
                type: "info"
            });
        }
    })

    socket.on("player:left", (payload = {}) => {
        const playerId = String(payload.playerId ?? "");
        const prevHostSocketId = get().hostSocketId;
        const nextHostSocketId = payload.hostSocketId ?? null;

        const currentPlayersById = get().playersById;
        const leavingPlayerName = currentPlayersById[playerId]?.name ?? "A player";
        const nextHostPlayerName = nextHostSocketId ? currentPlayersById[nextHostSocketId]?.name : "";
        const didHostChange = prevHostSocketId !== nextHostSocketId;

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

        const toastMessage = didHostChange && nextHostPlayerName
            ? `${leavingPlayerName} has left. ${nextHostPlayerName} is the new host.`
            : `${leavingPlayerName} has left.`;

        if (playerId !== get().selfPlayerId) {
            get().pushToast(toastMessage, {
                type: "info"
            });
        }
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

    socket.on("object:state", (payload = {}) => {
        const incomingObject = normalizeObjectState(payload.object);
        if (!incomingObject.id) {
            return;
        }

        set((state) => {
            const previousObject = state.objectsById[incomingObject.id];
            return {
                objectsById: {
                    ...state.objectsById,
                    [incomingObject.id]: previousObject ? {
                        ...previousObject,
                        ...incomingObject,
                    } : incomingObject,
                }
            };
        });
    });

    socket.on("chat:message", (payload = {}) => {
        const message = normalizeMessage(payload.message);
        if (!message.id) {
            return;
        }

        set((state) => {
            return {
                messages: appendMessage(state.messages, message)
            }
        })
    })

    socket.on("watch:state", (payload = {}) => {
        const incomingWatchTogether = normalizeWatchTogetherState(payload.watchTogether);

        set((state) => {
            const previousRawVersion = Number(state.watchTogether?.version ?? 0);
            const previousVersion = Number.isFinite(previousRawVersion) ? previousRawVersion : 0;
            
            // if incoming version is <= current version in state, ignore it to prevent stale/duplicate applies
            if (incomingWatchTogether.version <= previousVersion) {
                return state;
            }

            return {
                watchTogether: incomingWatchTogether,
            };
        });
    });

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
            
            // watch together state
            watchTogetherOpen: false,
            watchTogether: createDefaultWatchTogetherState(),

            localPlayerName: "",
            currentRoomId: null,
            selfPlayerId: null, // technically the same as socketId for now
            hostSocketId: null,

            socket: null,
            socketId: null, // technically the same as selfPlayerId for now
            socketConnected: false,
            socketListenersReady: false,
            socketErrorMessage: "", // note this is temporarily unused - would use if we want to add a persistent offline/connection banner
            localBubbleClearTimeoutId: null,
            toasts: [],

            // synced state
            playersById: {}, // object that maps player IDs to player objects
            objectsById: {}, // object that maps world object IDs to dynamic object state
            messages: [],

            pushToast: (message, { durationMs = DEFAULT_TOAST_DURATION_MS, highlightText = "", type = "info" } = {}) => {
                const safeMessage = String(message ?? "").trim();
                const safeHighlightText = String(highlightText ?? "").trim();
                const parsedDuration = Number(durationMs);
                const safeDurationMs = Number.isFinite(parsedDuration) && parsedDuration >= 0
                    ? parsedDuration
                    : DEFAULT_TOAST_DURATION_MS;

                if (!safeMessage) {
                    return null;
                }

                const toast = {
                    id: createToastId(),
                    type,
                    message: safeMessage,
                    durationMs: safeDurationMs,
                    highlightText: safeHighlightText,
                };

                set((state) => ({
                    toasts: [...state.toasts, toast].slice(-MAX_ACTIVE_TOASTS),
                }));

                return toast.id;
            },

            removeToast: (toastId) => {
                const safeToastId = String(toastId ?? "");
                if (!safeToastId) {
                    return;
                }

                set((state) => ({
                    toasts: state.toasts.filter((toast) => toast.id !== safeToastId),
                }));
            },

            clearToasts: () => {
                set({ toasts: [] });
            },
            
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
            
            
            openWatchTogether: () => {
                set({ watchTogetherOpen: true });
            },
            closeWatchTogether: () => {
                set({ watchTogetherOpen: false });
            },

            // commandPayload expects type, (video, queueIndex, timeSec, playbackStatus playbackRate...)
            sendWatchCommand: async (commandPayload = {}) => {
                const socket = get().socket;
                if (!socket?.connected) {
                    return { ok: false, message: "Socket is not connected." };
                }

                const nextPayload = { ...commandPayload };

                // sanitize commandPayload to prepare for emit
                const safeType = String(nextPayload.type ?? "").trim();
                if (!safeType) {
                    return { 
                        ok: false, 
                        message: "Watch command type is required." 
                    };
                }
                nextPayload.type = safeType;

                if (nextPayload.queueIndex !== undefined) {
                    const parsedQueueIndex = Number(nextPayload.queueIndex);
                    nextPayload.queueIndex = Number.isInteger(parsedQueueIndex) ? parsedQueueIndex : -1;
                }

                if (nextPayload.timeSec !== undefined) {
                    const parsedTimeSec = Number(nextPayload.timeSec);
                    nextPayload.timeSec = Number.isFinite(parsedTimeSec) ? Math.max(0, parsedTimeSec) : 0;
                }

                if (nextPayload.playbackRate !== undefined) {
                    const parsedRate = Number(nextPayload.playbackRate);
                    if (Number.isFinite(parsedRate)) {
                        nextPayload.playbackRate = Math.max(
                            WATCH_PLAYBACK_RATE_MIN,
                            Math.min(WATCH_PLAYBACK_RATE_MAX, parsedRate)
                        );
                    } else {
                        delete nextPayload.playbackRate;
                    }
                }

                // emit command and rely on watch:state socket event for authoritative state reconciliation -- 
                // don't set state based on response, because redudant and makes local out of sync
                try {
                    const response = await emitWithAck(socket, "watch:command", nextPayload);
                    if (!response.ok) {
                        const message = response.message ?? "Failed to update watch together state.";
                        return { ok: false, message };
                    }

                    return { ok: true };

                } catch (error) {
                    const message = error instanceof Error
                        ? error.message
                        : "Failed to update watch together state.";
                        
                    return { ok: false, message };
                }
            },

            watchQueueAdd: async (video = {}) => {
                const normalizedVideo = normalizeWatchQueueVideo(video);
                if (!normalizedVideo) {
                    return { ok: false, message: "A valid video is required." };
                }

                return get().sendWatchCommand({
                    type: "queue:add",
                    video: normalizedVideo,
                });
            },

            watchQueueRemove: async (queueIndex) => {
                const safeQueueIndex = Number(queueIndex);
                if (!Number.isInteger(safeQueueIndex) || safeQueueIndex < 0) {
                    return { ok: false, message: "Queue index is invalid." };
                }

                return get().sendWatchCommand({
                    type: "queue:remove",
                    queueIndex: safeQueueIndex,
                });
            },

            watchSetIndex: async ({ queueIndex, timeSec = 0 } = {}) => {
                const safeQueueIndex = Number(queueIndex);
                if (!Number.isInteger(safeQueueIndex) || safeQueueIndex < 0) {
                    return { ok: false, message: "Queue index is invalid." };
                }

                return get().sendWatchCommand({
                    type: "queue:set-index",
                    queueIndex: safeQueueIndex,
                    timeSec,
                });
            },

            watchQueueClear: async () => {
                return get().sendWatchCommand({
                    type: "queue:clear",
                });
            },

            watchPlay: async ({ timeSec, playbackRate } = {}) => {
                const payload = {
                    type: "playback:play",
                };

                if (timeSec !== undefined) {
                    payload.timeSec = timeSec;
                }

                if (playbackRate !== undefined) {
                    payload.playbackRate = playbackRate;
                }

                return get().sendWatchCommand(payload);
            },

            watchPause: async ({ timeSec } = {}) => {
                const payload = {
                    type: "playback:pause",
                };

                if (timeSec !== undefined) {
                    payload.timeSec = timeSec;
                }

                return get().sendWatchCommand(payload);
            },

            watchSeek: async ({ timeSec, playbackStatus } = {}) => {
                const payload = {
                    type: "playback:seek",
                };

                if (timeSec !== undefined) {
                    payload.timeSec = timeSec;
                }

                if (playbackStatus !== undefined) {
                    payload.playbackStatus = playbackStatus;
                }

                return get().sendWatchCommand(payload);
            },

            watchSetRate: async ({ playbackRate, timeSec } = {}) => {
                if (playbackRate === undefined) {
                    return { ok: false, message: "Playback rate is required." };
                }

                const payload = {
                    type: "playback:rate",
                    playbackRate,
                };

                if (timeSec !== undefined) {
                    payload.timeSec = timeSec;
                }

                return get().sendWatchCommand(payload);
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
                // note this function assumes that playerName is safe (already trimmed)
                try {
                    const socket = await get().initializeSocket();
                    const response = await emitWithAck(socket, "room:create", {
                        playerName: playerName,
                        worldType,
                    })

                    if (!response.ok || !response.room?.id) {
                        const message = response.message ?? "Failed to create room.";
                        return { ok: false, message }
                    }

                    applyRoomSnapshot(set, response.room, response.selfPlayerId ?? null);
                    
                    set({
                        localPlayerName: playerName,
                    });

                    const shareableLink = buildRoomShareLink(response.room.id);
                    get().pushToast(`Room created! Share this link: ${shareableLink}`, {
                        type: "success",
                        durationMs: 10000,
                        highlightText: shareableLink,
                    });

                    return {
                        ok: true,
                        roomId: response.room.id,
                    }

                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to create room.";
                    return { ok: false, message }
                }
            },

            joinRoom: async ({ roomId, playerName } = {}) => {
                const safeRoomId = String(roomId ?? "").trim();
                const safePlayerName = String(playerName ?? "").trim();

                if (!safeRoomId) {
                    const message = "Room ID is required.";
                    return { ok: false, message };
                }

                if (!safePlayerName) {
                    const message = "Name is required.";
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
                        return { ok: false, message }
                    }

                    applyRoomSnapshot(set, response.room, response.selfPlayerId ?? null);
                    set({
                        localPlayerName: safePlayerName
                    })

                    get().pushToast(`Joined room ${response.room.id}.`, {
                        type: "success"
                    });

                    return {
                        ok: true,
                        roomId: response.room.id,
                    }

                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to join room.";
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

                // if no fields are in the payload (no args provided), don't emit at all
                if (Object.keys(payload).length === 0) {
                    return;
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

            sendObjectUpdate: ({ objectId, position, quaternion, linvel, angvel } = {}) => {
                const socket = get().socket;
                const selfPlayerId = get().selfPlayerId;
                const safeObjectId = String(objectId ?? "").trim();

                if (!socket?.connected || !selfPlayerId || !safeObjectId) {
                    return;
                }

                const payload = { objectId: safeObjectId };

                if (position !== undefined) {
                    payload.position = toSafeVector3(position, [0, 0, 0]);
                }
                if (quaternion !== undefined) {
                    payload.quaternion = toSafeVector4(quaternion, [0, 0, 0, 1]);
                }
                if (linvel !== undefined) {
                    payload.linvel = toSafeVector3(linvel, [0, 0, 0]);
                }
                if (angvel !== undefined) {
                    payload.angvel = toSafeVector3(angvel, [0, 0, 0]);
                }

                socket.emit("object:update", payload);
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
                        return { ok: false, message }
                    }

                    // clear previous timeout
                    const previousTimeoutId = get().localBubbleClearTimeoutId;
                    if (previousTimeoutId) {
                        window.clearTimeout(previousTimeoutId);
                    }

                    // set new timeout for message clear
                    const timeoutId = window.setTimeout(() => {
                        get().sendPlayerUpdate({ activeMessage: "" });
                        set({ localBubbleClearTimeoutId: null });
                    }, 5000);

                    set({ localBubbleClearTimeoutId: timeoutId });
                    return { ok: true };

                } catch (error) {
                    const message = error instanceof Error ? error.message : "Failed to send message.";
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
