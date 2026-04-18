import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Stats } from "@react-three/drei";

import Crosshair from "../components/ui/Crosshair.jsx";
import { useGameStore } from "../store/useGameStore.js";
import ChatPanel from "./ChatPanel.jsx";
import WatchTogetherInterface from "./WatchTogetherInterface.jsx";
import PlaybackControls from "./PlaybackControls.jsx";

// ?react is a vite query suffix that tells the svg plug (vite-plugin0svgr) to transform the svg into a React component
import HelpIcon from "../assets/icons/help_outline.svg?react";
import SunsetIcon from "../assets/icons/sunset-icon.webp";
import SoundOnIcon from  "../assets/icons/sound_on.svg?react";

import SunnyIcon from "../assets/icons/wb_sunny.svg?react";
import SoundOffIcon from "../assets/icons/sound_off.svg?react";

import CopyIcon from "../assets/icons/content_copy.svg?react";

import PlayerListIcon from "../assets/icons/groups.svg?react";
import PersonIcon from "../assets/icons/person.svg?react";
import SettingsIcon from "../assets/icons/settings.svg?react";
import ToggleButton from "../components/ui/ToggleButton.jsx";

const TOGGLE_BUTTON_CLASS =
    "cursor-pointer select-none transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-100 hover:opacity-95 active:opacity-90";
const MIN_SOUND_EFFECTS_VOLUME = 0;
const MAX_SOUND_EFFECTS_VOLUME = 100;
const PLAYER_AFK_THRESHOLD_MS = 3 * 60 * 1000;
const PLAYER_LIST_CLOCK_INTERVAL_MS = 15 * 1000;

const HELP_OVERLAY_SEEN_KEY = "shiba-world-help-overlay-seen-v1";

const copyTextToClipboard = async (text) => {
    const safeText = String(text ?? "").trim();
    if (!safeText) {
        return false;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeText);
        return true;
    }

    if (typeof document === "undefined") {
        return false;
    }

    // fallback in case navigator.clipboard doesn't work
    const textArea = document.createElement("textarea");
    textArea.value = safeText;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();

    let didCopy = false;
    try { // note that without a catch, the error is not slawlloed and continues upward until some outer catch handles it
        didCopy = document.execCommand("copy"); // warning is expected since its used as a legacy fallback
    } finally {
        document.body.removeChild(textArea);
    }

    return didCopy;
};

const getIsFirstVisit = () => {
    // default to true for non-browser environments (window.locaStorage would through)
    if (typeof window === "undefined") {
        return true;
    }

    try {
        // if seen value in local storage is 1, that means user has saved this key in their localStorage --> they've ran help info useEffect before
        return window.localStorage.getItem(HELP_OVERLAY_SEEN_KEY) !== "1";
    } catch {
        // If storage is unavailable, keep onboarding behavior.
        return true;
    }
};

const EMPTY_WATCH_QUEUE = Object.freeze([]);

const getIsPlayerAway = (player, nowMs) => {
    const updatedAtMs = Date.parse(player?.updatedAt ?? "");
    if (!Number.isFinite(updatedAtMs)) {
        return false;
    }

    return Math.max(0, nowMs - updatedAtMs) >= PLAYER_AFK_THRESHOLD_MS;
};

const getCapacityClass = (playerCount, maxPlayers) => {
    if (!Number.isFinite(playerCount) || !Number.isFinite(maxPlayers) || maxPlayers <= 0) {
        return "text-[#A6A6A6]";
    }

    
    const capacityRatio = playerCount / maxPlayers;
    
    if (capacityRatio < 0.75) { // 0.75 = 6/8
        return "text-emerald-400/80";
    } 
    if (capacityRatio < 1) {
        return "text-amber-300/80";
    }
        
    return "text-rose-400/80";
}

const GameOverlay = () => {
    const [isFirstVisit] = useState(() => getIsFirstVisit());
    const [isHelpEnabled, setIsHelpEnabled] = useState(isFirstVisit);
    const [isSettingsEnabled, setIsSettingsEnabled] = useState(false);
    const [isPlayerListEnabled, setIsPlayerListEnabled] = useState(false);
    const [playerListNowMs, setPlayerListNowMs] = useState(() => Date.now());

    const statsParentRef = useRef(null);
    const navigate = useNavigate();

    const currentRoomId = useGameStore((state) => state.currentRoomId)
    const selfPlayerId = useGameStore((state) => state.selfPlayerId);
    const hostSocketId = useGameStore((state) => state.hostSocketId);
    const maxPlayers = useGameStore((state) => state.maxPlayers);
    const playersById = useGameStore((state) => state.playersById);

    const watchTogetherQueue = useGameStore((state) => state.watchTogether.queue)
    const watchTogetherOpen = useGameStore((state) => state.watchTogetherOpen);

    const cameraLockMode = useGameStore((state) => state.cameraLockMode);
    const sunsetMode = useGameStore((state) => state.sunsetMode);
    // const voiceEnabled = useGameStore((state) => state.voiceEnabled);
    const soundEffectsVolume = useGameStore((state) => state.soundEffectsVolume);
    const videoScreenEnabled = useGameStore((state) => state.videoScreenEnabled);
    const shadowsEnabled = useGameStore((state) => state.shadowsEnabled);
    const infiniteJumpEnabled = useGameStore((state) => state.infiniteJumpEnabled);
    const debugModeEnabled = useGameStore((state) => state.debugModeEnabled);

    const toggleSunsetMode = useGameStore((state) => state.toggleSunsetMode);
    // const toggleVoiceEnabled = useGameStore((state) => state.toggleVoiceEnabled);
    const setSoundEffectsVolume = useGameStore((state) => state.setSoundEffectsVolume);
    const toggleVideoScreenEnabled = useGameStore((state) => state.toggleVideoScreenEnabled);
    const toggleShadowsEnabled = useGameStore((state) => state.toggleShadowsEnabled);
    const toggleInfiniteJumpEnabled = useGameStore((state) => state.toggleInfiniteJumpEnabled);
    const toggleDebugModeEnabled = useGameStore((state) => state.toggleDebugModeEnabled);
    const requestResetCharacter = useGameStore((state) => state.requestResetCharacter);
    const leaveRoom = useGameStore((state) => state.leaveRoom);
    const pushToast = useGameStore((state) => state.pushToast);
    const lastNonZeroSoundEffectsVolumeRef = useRef(
        Math.max(1, Number(soundEffectsVolume) || MAX_SOUND_EFFECTS_VOLUME)
    );

    const videoQueue = Array.isArray(watchTogetherQueue) ? watchTogetherQueue : EMPTY_WATCH_QUEUE;
    const hasQueuedVideos = videoQueue.length > 0;
    const soundEffectsMuted = soundEffectsVolume <= MIN_SOUND_EFFECTS_VOLUME;

    const players = useMemo(() => {
        return Object.values(playersById)
            .filter((player) => player?.id)
            .sort((playerA, playerB) => {
                // always put current player at the top
                const playerAIsSelf = playerA.id === selfPlayerId;
                const playerBIsSelf = playerB.id === selfPlayerId;
                if (playerAIsSelf) {
                    return -1;
                }
                if (playerBIsSelf) {
                    return 1;
                }

                const playerAIsHost = playerA.id === hostSocketId;
                const playerBIsHost = playerB.id === hostSocketId;

                if (playerAIsHost) {
                    return -1;
                }
                if (playerBIsHost) {
                    return 1;
                }

                // sort everyone else alphabetically by name
                return playerA.name.localeCompare(playerB.name);
            });
    }, [hostSocketId, playersById, selfPlayerId]);

    const playerCount = players.length;
    const playerCapacityLabel = Number.isFinite(maxPlayers) && maxPlayers > 0
        ? `${playerCount}/${maxPlayers}`
        : String(playerCount);

    // Show help dropdown for first-time visitors, then auto-hide once.
    useEffect(() => {
        if (!isFirstVisit) {
            return;
        }

        try { // sicne localStorage can throw at runtime in some environments
            window.localStorage.setItem(HELP_OVERLAY_SEEN_KEY, "1");
        } catch {
            // no-op
        }

        const autoHideHelpTimeoutId = window.setTimeout(() => {
            setIsHelpEnabled(false);
        }, 8000);

        // only for the case where the timer hasn't fired (before 8s). After 8s, clearTimeout does nothing
        return () => {
            window.clearTimeout(autoHideHelpTimeoutId);
        };
    }, [isFirstVisit]);

    useEffect(() => {
        if (soundEffectsVolume > MIN_SOUND_EFFECTS_VOLUME) {
            lastNonZeroSoundEffectsVolumeRef.current = soundEffectsVolume;
        }
    }, [soundEffectsVolume]);

    // useEffect to setPlayerListNowMs every PLAYER_LIST_CLOCK_INTERVAL_MS
    useEffect(() => {
        if (!isPlayerListEnabled) {
            return;
        }

        setPlayerListNowMs(Date.now());

        const clockIntervalId = window.setInterval(() => {
            setPlayerListNowMs(Date.now());
        }, PLAYER_LIST_CLOCK_INTERVAL_MS);

        return () => {
            window.clearInterval(clockIntervalId);
        };
    }, [isPlayerListEnabled]);

    const handleResetCharacterClick = (event) => {
        requestResetCharacter();
        // event.target is the deepest element that was actually clicked (could be a child inside the button)
        // event.currentTarget is the element that the handler is attached to, which is the button, which we want to blur
        event.currentTarget.blur();
    };

    const handleCopyRoomIdClick = async (event) => {
        event.currentTarget.blur(); // remember that event.target is the deepest element that triggered the event, not necessarily the element the handler is attached to

        const safeRoomId = String(currentRoomId ?? "").trim();
        if (!safeRoomId) {
            pushToast("Room code unavailable.");
            return;
        }

        try {
            const didCopy = await copyTextToClipboard(safeRoomId);
            if (!didCopy) {
                throw new Error("Copy command was rejected.");
            }

            pushToast("Room code copied.", {
                type: "success",
                durationMs: 2000
            });
        } catch {
            pushToast("Failed to copy room code.");
        }
    };

    const handleLeaveRoomClick = async (event) => {
        event.currentTarget.blur();
        await leaveRoom();
        navigate("/");
    };

    const handleToggleSoundEffectsMuted = (event) => {
        if (soundEffectsMuted) {
            const restoredVolume = Math.max(
                1,
                Math.min(MAX_SOUND_EFFECTS_VOLUME, Number(lastNonZeroSoundEffectsVolumeRef.current) || 50)
            );
            setSoundEffectsVolume(restoredVolume);
        } else {
            lastNonZeroSoundEffectsVolumeRef.current = soundEffectsVolume;
            setSoundEffectsVolume(MIN_SOUND_EFFECTS_VOLUME);
        }

        event.currentTarget.blur();
    };

    return (
        <div className="pointer-events-none absolute inset-0 z-50">
            <div className="absolute top-0 left-0 right-0 m-2 flex flex-row justify-between">
                {/* Left side controls and fps panel anchor */}
                <div className="inline-flex items-start gap-2.5">
                    {/* Toggles */}
                    <div className="pointer-events-auto inline-flex flex-row gap-2.5 px-3.5 py-2.5 bg-[rgba(85,85,85,0.8)] rounded-4xl relative">
                        <button
                            type="button"
                            aria-label="Toggle help"
                            aria-pressed={isHelpEnabled}
                            onClick={(e) => {
                                setIsHelpEnabled((prev) => !prev)
                                e.currentTarget.blur() // hide the persistent focus outline/ring after mouse/touch click
                            }}
                            className={TOGGLE_BUTTON_CLASS}
                        >
                            <HelpIcon className={`w-8 sm:w-10 h-auto ${isHelpEnabled ? "text-primary" : "text-white"}`} />
                        </button>
                        
                        <button
                            type="button"
                            aria-label="Toggle sunset mode"
                            aria-pressed={sunsetMode}
                            onClick={(e) => {
                                toggleSunsetMode()
                                e.currentTarget.blur()
                            }}
                            className={`${TOGGLE_BUTTON_CLASS} shrink-0`}
                        >
                            {sunsetMode ? (
                                <img
                                    src={SunsetIcon}
                                    alt="Sunset mode enabled"
                                    draggable={false}
                                    className="w-8 sm:w-10 h-auto"
                                />
                            ) : (
                                <SunnyIcon className="w-8 sm:w-10 h-auto text-white" />
                            )}
                        </button>

                        {/* <button
                            type="button"
                            aria-label="Toggle microphone"
                            aria-pressed={voiceEnabled}
                            onClick={(e) => {
                                toggleVoiceEnabled()
                                e.currentTarget.blur()
                            }}
                            className={TOGGLE_BUTTON_CLASS}
                        >
                            {voiceEnabled ? (
                                <MicOnIcon className="w-8 sm:w-10 h-auto text-white" />
                            ) : (
                                <MicOffIcon className="w-8 sm:w-10 h-auto text-white" />
                            )}
                        </button>
                        
                        <button
                            type="button"
                            aria-label="Toggle sound"
                            aria-pressed={soundEnabled}
                            onClick={(e) => {
                                toggleSoundEnabled();
                                e.currentTarget.blur()
                            }}
                            className={TOGGLE_BUTTON_CLASS}
                        >
                            {soundEnabled ? (
                                <SoundOnIcon className="w-8 sm:w-10 h-auto text-white" />
                            ) : (
                                <SoundOffIcon className="w-8 sm:w-10 h-auto text-white" />
                            )}
                        </button> */}

                        {/* Help dropdown */}
                        <div
                            aria-hidden={!isHelpEnabled}
                            className={`flex flex-col absolute px-5 py-4 left-0 gap-1 top-[calc(100%+10px)] bg-[rgba(85,85,85,0.8)] rounded-2xl transition-all duration-200 ease-out
                                ${isHelpEnabled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"}`}
                        >
                            <h1 className="text-[1rem] text-center">Controls</h1>
                            <hr />
                            <div className="flex flex-row justify-between gap-4">
                                <p className="whitespace-nowrap">move</p>
                                <p className="text-primary whitespace-nowrap" >WASD</p>
                            </div>
                            <div className="flex flex-row justify-between gap-4">
                                <p className="whitespace-nowrap">jump</p>
                                <p className="text-primary whitespace-nowrap">SPACE</p>
                            </div>
                            <div className="flex flex-row justify-between gap-4">
                                <p className="whitespace-nowrap">orbit</p>
                                <p className="text-primary whitespace-nowrap">left mouse</p>
                            </div>
                            <div className="flex flex-row justify-between gap-4">
                                <p className="whitespace-nowrap">zoom</p>
                                <p className="text-primary whitespace-nowrap">middle mouse / mousewheel</p>
                            </div>
                            <div className="flex flex-row justify-between gap-4">
                                <p className="whitespace-nowrap">shift camera lock</p>
                                <p className="text-primary whitespace-nowrap">shift</p>
                            </div>
                            <div className="flex flex-row justify-between gap-4">
                                <p className="whitespace-nowrap">interact</p>
                                <p className="text-primary whitespace-nowrap">E</p>
                            </div>
                            <div className="flex flex-row justify-between gap-4">
                                <p className="whitespace-nowrap">chat</p>
                                <p className="text-primary whitespace-nowrap">ENTER / T</p>
                            </div>

                        </div>
                    </div>

                    {/* Stats - needs parent node because Stats creates a raw DOM node and needs to appear it somewhere. otherwise, would default to document.body */}
                    {/* it does: "const parent = (parentProp && parentProp.current) || document.body; parent.appendChild(stats.dom)" */}
                    <div
                        ref={statsParentRef}
                        aria-hidden
                        className={`pointer-events-auto relative h-12 overflow-hidden transition-[width] duration-150 ${debugModeEnabled ? "w-20" : "w-0"}`}
                    >
                        {debugModeEnabled ? (
                            <Stats
                                parent={statsParentRef}
                                showPanel={0}
                                className="absolute! left-0! top-0! right-auto! bottom-auto!"
                            />
                        ) : null}
                    </div>
                </div>

                {/* Right side */}
                <div className="pointer-events-auto flex flex-row gap-3">
                    {/* Room code */}
                    <button
                        type="button"
                        aria-label="Copy room id"
                        onClick={handleCopyRoomIdClick}
                        disabled={!currentRoomId}
                        className="hidden xs2:flex flex-row items-center self-center gap-2.5 rounded-4xl bg-[rgba(85,85,85,0.5)] px-4 py-2.5 transition-colors duration-200
                            hover:cursor-pointer hover:bg-[rgba(85,85,85,0.8)] focus-visible:bg-[rgba(85,85,85,0.8)] disabled:cursor-not-allowed disabled:opacity-60
                            text-sm sm:text-[1rem] whitespace-nowrap"
                    >
                        <p><span className="hidden xs:inline">Room</span> <span className="text-primary">{currentRoomId}</span></p>
                        <CopyIcon className="w-4 sm:w-5 h-auto text-white" />
                    </button>

                    {/* Player List and Settings */}
                    <div className="pointer-events-auto inline-flex flex-row gap-2.5 px-3.5 py-2.5 bg-[rgba(85,85,85,0.8)] rounded-4xl relative">
                        <button
                            type="button"
                            aria-label="Toggle player list"
                            aria-pressed={isPlayerListEnabled}
                            onClick={(e) => {
                                setIsPlayerListEnabled((prev) => {
                                    const nextIsEnabled = !prev;
                                    if (nextIsEnabled) {
                                        setIsSettingsEnabled(false);
                                    }
                                    return nextIsEnabled;
                                });
                                e.currentTarget.blur();
                            }}
                            className={TOGGLE_BUTTON_CLASS}
                        >
                            <PlayerListIcon className={`w-8 sm:w-10 h-auto ${isPlayerListEnabled ? "text-primary" : "text-white"}`} />
                        </button>

                        <button
                            type="button"
                            aria-label="Toggle settings"
                            aria-pressed={isSettingsEnabled}
                            onClick={(e) => {
                                setIsSettingsEnabled((prev) => {
                                    const nextIsEnabled = !prev;
                                    if (nextIsEnabled) {
                                        setIsPlayerListEnabled(false);
                                    }
                                    return nextIsEnabled;
                                });
                                e.currentTarget.blur();
                            }}
                            className={TOGGLE_BUTTON_CLASS}
                        >
                            <SettingsIcon className={`w-8 sm:w-10 h-auto ${isSettingsEnabled ? "text-primary" : "text-white"}`} />
                        </button>

                        {/* Player list dropdown */}
                        <div
                            aria-hidden={!isPlayerListEnabled}
                            className={`text-sm sm:text-[1rem] flex min-w-64 max-w-[calc(100vw-1rem)] flex-col absolute p-5 right-0 gap-2 top-[calc(100%+10px)] bg-[rgba(85,85,85,0.8)] rounded-2xl transition-all 
                                duration-200 ease-out ${isPlayerListEnabled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"}`}
                        >
                            <div className="flex flex-row items-center justify-between gap-4">
                                <p className="whitespace-nowrap">
                                    Players:
                                </p>
                                <div className={`flex flex-row items-center gap-0.5 ${getCapacityClass(playerCount, maxPlayers)}`}>
                                    <span className="tabular-nums">{playerCapacityLabel}</span>  
                                    <PersonIcon className="w-5 sm:w-6 h-auto shrink-0 " />
                                </div>
                            </div>
                            <hr />
                            <div className="app-scroll flex max-h-72 flex-col gap-1.5 overflow-y-auto">
                                {players.length > 0 ? (
                                    players.map((player) => {
                                        const isAway = getIsPlayerAway(player, playerListNowMs);
                                        const statusClass = isAway ? "bg-amber-300/80" : "bg-emerald-400/80";
                                        const isSelf = player.id === selfPlayerId;
                                        const isHost = player.id === hostSocketId;

                                        return (
                                            <div
                                                key={player.id}
                                                className="flex flex-row items-center justify-between gap-5 rounded-lg bg-white/10 px-3 py-1"
                                            >
                                                <div className="flex flex-row items-center gap-2 min-w-0">
                                                    <p className="min-w-0 max-w-60 truncate" title={player.name}>
                                                        {player.name}
                                                    </p>
                                                    <div className="flex flex-row items-center gap-1">
                                                        {isSelf &&
                                                            <span className="text-xs sm:text-sm px-2 py-px bg-[#37839A] rounded-3xl">YOU</span>
                                                        }
                                                        {isHost &&
                                                            <span className="text-xs sm:text-sm px-2 py-px bg-primary rounded-3xl">HOST</span>
                                                        }
                                                    </div>
                                                </div>
                                                
                                                <div className="flex shrink-0 flex-row items-center gap-2">
                                                    <span
                                                        aria-label={isAway ? "Away" : "Active"}
                                                        title={isAway ? "Away" : "Active"}
                                                        className={`h-2.5 w-2.5 rounded-full ${statusClass}`}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="whitespace-nowrap text-[#A6A6A6]">No players</p>
                                )}
                            </div>
                        </div>

                        {/* Settings dropdown */}
                        <div
                            aria-hidden={!isSettingsEnabled}
                            className={`text-sm sm:text-[1rem] flex flex-col absolute p-5 right-0 gap-4 top-[calc(100%+10px)] bg-[rgba(85,85,85,0.8)] rounded-2xl transition-all
                                duration-200 ease-out ${isSettingsEnabled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"}`}
                        >
                            {/* room code on small screens */}
                            <button
                                type="button"
                                aria-label="Copy room id"
                                onClick={handleCopyRoomIdClick}
                                disabled={!currentRoomId}
                                className="xs2:hidden flex flex-row items-center self-center gap-2.5
                                    hover:cursor-pointer whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <p>Room Code: <span className="text-primary">{currentRoomId}</span></p>
                                <CopyIcon className="w-4 sm:w-5 h-auto text-white" />
                            </button>
                            <hr className="xs2:hidden" />

                            {/* Toggles */}
                            <div className="flex flex-col gap-1.5">
                                <div className="flex flex-row items-center justify-between gap-4">
                                    <p className="whitespace-nowrap">Sound Effect Volume</p>
                                    <div className="flex flex-row items-center gap-2 sm:gap-3">
                                        <button
                                            type="button"
                                            aria-label={soundEffectsMuted ? "Unmute sound effects" : "Mute sound effects"}
                                            aria-pressed={soundEffectsMuted}
                                            onClick={handleToggleSoundEffectsMuted}
                                            className={TOGGLE_BUTTON_CLASS}
                                        >
                                            {soundEffectsMuted ? (
                                                <SoundOffIcon className="w-4 sm:w-5 h-auto text-white" />
                                            ) : (
                                                <SoundOnIcon className="w-4 sm:w-5 h-auto text-white" />
                                            )}
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={soundEffectsVolume}
                                            onChange={(event) => {
                                                setSoundEffectsVolume(event.target.value);
                                            }}
                                            onPointerUp={(event) => {
                                                event.currentTarget.blur();
                                            }}
                                            aria-label="Sound effects volume slider"
                                            className="w-24 sm:w-28 accent-primary cursor-pointer"
                                        />
                                        <p className="w-4 sm:w-6 text-right tabular-nums">
                                            {soundEffectsVolume}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-row justify-between gap-4">
                                    <p className="whitespace-nowrap">Video Screen Enabled</p>
                                    <ToggleButton
                                        ariaLabel="Toggle video screen"
                                        enabled={videoScreenEnabled}
                                        onToggle={(e) => {
                                            toggleVideoScreenEnabled();
                                            e.currentTarget.blur();
                                        }}
                                    />
                                </div>
                                <div className="flex flex-row justify-between gap-4">
                                    <p className="whitespace-nowrap">Shadows</p>
                                    <ToggleButton
                                        ariaLabel="Toggle shadows"
                                        enabled={shadowsEnabled}
                                        onToggle={(e) => {
                                            toggleShadowsEnabled();
                                            e.currentTarget.blur();
                                        }}
                                    />
                                </div>
                                <div className="flex flex-row justify-between gap-4">
                                    <p className="whitespace-nowrap">Infinite Jump</p>
                                    <ToggleButton
                                        ariaLabel="Toggle infinite jump"
                                        enabled={infiniteJumpEnabled}
                                        onToggle={(e) => {
                                            toggleInfiniteJumpEnabled();
                                            e.currentTarget.blur();
                                        }}
                                    />
                                </div>
                                <div className="flex flex-row justify-between gap-4">
                                    <p className="whitespace-nowrap">Debug Mode</p>
                                    <ToggleButton
                                        ariaLabel="Toggle debug mode"
                                        enabled={debugModeEnabled}
                                        onToggle={(e) => {
                                            toggleDebugModeEnabled();
                                            e.currentTarget.blur();
                                        }}
                                    />
                                </div>
                            </div>

                            <hr />

                            {/* Buttons */}
                            <div className="flex flex-col gap-1.5 items-center">
                                <button
                                    type="button"
                                    className="w-full cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white transition-opacity duration-150 ease-out hover:opacity-90 active:opacity-80"
                                    onClick={handleResetCharacterClick}
                                >
                                    Reset Character
                                </button>
                                <button
                                    type="button"
                                    className="w-full cursor-pointer rounded-lg border border-red-300/30 bg-red-400/15 px-3 py-1.5 text-sm text-red-100 transition-opacity duration-150 ease-out hover:opacity-90 active:opacity-80"
                                    onClick={handleLeaveRoomClick}
                                >
                                    Leave Room
                                </button>
                            </div>

                        </div>
                    </div>
                </div>

                { cameraLockMode && <Crosshair /> }
            </div>


            <ChatPanel
                topOverlay={
                    !watchTogetherOpen && hasQueuedVideos ? (
                        <PlaybackControls outerClassName="xl:hidden z-60 pointer-events-auto" />
                    ) : null
                }
            />

            <WatchTogetherInterface isOpen={watchTogetherOpen} />

            {!watchTogetherOpen && hasQueuedVideos &&
                <PlaybackControls outerClassName="hidden xl:flex absolute z-60 pointer-events-auto bottom-4 left-1/2 -translate-x-1/2"/>
            }
        </div>
    )
}

export default GameOverlay
