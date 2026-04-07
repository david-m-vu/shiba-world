import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "../store/useGameStore.js";

import SearchIcon from "../assets/icons/search.svg?react";
import DeleteIcon from "../assets/icons/delete.svg?react";
import TrendingIcon from "../assets/icons/trending.svg?react";
import MusicNoteIcon from "../assets/icons/music_note.svg?react";
import CloseIcon from "../assets/icons/close.svg?react";
import ShibaInuFace from "../assets/icons/shiba-inu.png";
import ExpandMoreIcon from "../assets/icons/expand_more.svg?react"

import { getYoutubeIframeApi } from "../lib/youtubeIframeApi.js";
import {
    extractYoutubeVideoId,
    formatPublishedAgo,
    formatVideoDuration,
    formatViews,
    getEffectiveWatchTimeSec
} from "../lib/watchTogetherHelpers.js";

const SERVER_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

const PRESET_OPTIONS = [
    {
        IconComponent: MusicNoteIcon,
        iconClassName: "text-[#80E791]",
        textStyle: "bg-linear-to-r from-[#05DF72] to-[#80E791] bg-clip-text text-transparent text-[#80E791]",
        value: "trending_music_videos", 
        label: "Trending Music Videos" 
    },
    { 
        IconComponent: TrendingIcon,
        iconClassName: "text-primary",
        textStyle: "text-primary",
        value: "trending_videos", 
        label: "Trending Videos" 
    },
    { 
        IconComponent: MusicNoteIcon,
        iconClassName: "text-[#F210FA]",
        textStyle: "bg-linear-to-r from-[#C576FF] to-[#F210FA] bg-clip-text text-transparent text-[#F210FA]",
        value: "kpop_music_videos", 
        label: "K-pop Music Videos" 
    },
];

const DEFAULT_PRESET = "trending_music_videos";
const EMPTY_WATCH_QUEUE = Object.freeze([]); // gives a stable reference so hooks that depend on videoQueue don't think it changed when watchTogether.queue is missing
const WATCH_VOLUME_MIN = 0;
const WATCH_VOLUME_MAX = 100;
const WATCH_VOLUME_POLL_INTERVAL_MS = 500;
const WATCH_VOLUME_APPLY_SUPPRESS_MS = 350;

const WatchTogetherInterface = ({ isOpen }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
    const [activePreset, setActivePreset] = useState(null);

    const [openQueueMenuIndex, setOpenQueueMenuIndex] = useState(null);
    const [queueMenuPosition, setQueueMenuPosition] = useState(null);

    const [playerError, setPlayerError] = useState("");

    const hasInitializedDefaultRef = useRef(false);
    const panelRef = useRef(null);
    const queueMenuRef = useRef(null);
    const presetDropdownRef = useRef(null);
    const playerHostRef = useRef(null); // the div where the youtube iframe will be placed
    const playerRef = useRef(null);
    const playerReadyRef = useRef(false);
    const latestSearchRequestIdRef = useRef(0);

    const suppressPlayerEventsRef = useRef(false);
    const suppressPlayerEventsTimeoutRef = useRef(null);
    const suppressVolumePollUntilTsRef = useRef(0);
    const videoQueueRef = useRef([]); // use this instead of videoQueue so that it doesn't force callbacks/effects to reinitialize every queue update
    const currentQueueIndexRef = useRef(-1);
    const localWatchVolumeRef = useRef(100);
    const localWatchMutedRef = useRef(false);

    const watchTogether = useGameStore((state) => state.watchTogether);

    const closeWatchTogether = useGameStore((state) => state.closeWatchTogether);
    const watchQueueAdd = useGameStore((state) => state.watchQueueAdd);
    const watchQueueRemove = useGameStore((state) => state.watchQueueRemove);
    const watchSetIndex = useGameStore((state) => state.watchSetIndex);

    const watchPlay = useGameStore((state) => state.watchPlay);
    const watchPause = useGameStore((state) => state.watchPause);
    const watchSetRate = useGameStore((state) => state.watchSetRate);
    const watchVolume = useGameStore((state) => state.watchVolume);
    const watchMuted = useGameStore((state) => state.watchMuted);
    const setWatchVolume = useGameStore((state) => state.setWatchVolume);
    const setWatchMuted = useGameStore((state) => state.setWatchMuted);

    // variables stemming from global watchTogether state
    const videoQueue = Array.isArray(watchTogether.queue) ? watchTogether.queue : EMPTY_WATCH_QUEUE;
    const currentQueueIndex = Number.isInteger(watchTogether.currentQueueIndex) ? watchTogether.currentQueueIndex : -1;
    const playbackStatus = String(watchTogether.playbackStatus ?? "paused").toLowerCase() === "playing" ? "playing" : "paused";
    const playbackRate = Number.isFinite(Number(watchTogether.playbackRate)) ? Number(watchTogether.playbackRate) : 1;
    const anchorTimeSec = Number.isFinite(Number(watchTogether.anchorTimeSec)) ? Number(watchTogether.anchorTimeSec) : 0;
    const anchorServerTsMs = Number.isFinite(Number(watchTogether.anchorServerTsMs))
        ? Number(watchTogether.anchorServerTsMs)
        : Date.now(); // fallback to Date.now() makes elapsed time ~0, so behavior degrades safely to "play near ahcorTimeSec" until real server state arrives

    const hasQueuedVideos = videoQueue.length > 0;
    const currentQueuedVideo = currentQueueIndex >= 0 ? (videoQueue[currentQueueIndex] ?? null) : null;
    const currentVideoId = currentQueuedVideo?.videoId ?? "";
    const activePresetObj = PRESET_OPTIONS.find((preset) => preset.value === activePreset) ?? null;

    // blur any currently focused element inside the panel
    const blurFocusedPanelElement = () => {
        // if focus is on the Document itself or body/html, can fail strict HTMLElement assumptions,
        // or another example is if focus is inside SVG element (SVGElement, not HTMLElement)
        if (!(document.activeElement instanceof HTMLElement)) {
            return;
        }

        if (panelRef.current?.contains(document.activeElement)) {
            document.activeElement.blur();
        }
    };

    // keep videoQueueRef in sync
    useEffect(() => {
        videoQueueRef.current = videoQueue;
    }, [videoQueue]);

    // keep currentQueueIndexRef in sync
    useEffect(() => {
        currentQueueIndexRef.current = currentQueueIndex;
    }, [currentQueueIndex]);

    // these refs hold the latest watchVolume / watchMuted for the setInterval callback
    // since setInterval closes over the ref object, not the ref's current value
    useEffect(() => {
        localWatchVolumeRef.current = watchVolume;
        localWatchMutedRef.current = watchMuted;
    }, [watchMuted, watchVolume]);

    // handle cases where the open queue menu index becomes invalid as a result of deletion
    useEffect(() => {
        if (openQueueMenuIndex === null) {
            return;
        }

        if (openQueueMenuIndex < videoQueue.length) {
            return;
        }

        setOpenQueueMenuIndex(null);
        setQueueMenuPosition(null);
    }, [openQueueMenuIndex, videoQueue.length]);

    // blur any focused element when WatchTogetherInterface is closed
    useEffect(() => {
        if (!isOpen) {
            blurFocusedPanelElement();
            setOpenQueueMenuIndex(null);
            setQueueMenuPosition(null);
            setIsPresetDropdownOpen(false);
        }
    }, [isOpen]);

    // set event listener for escape press to close WatchTogetherInterface
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleEscapeToClose = (event) => {
            if (event.key !== "Escape") {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            closeWatchTogether();
        };

        window.addEventListener("keydown", handleEscapeToClose, true);
        return () => {
            window.removeEventListener("keydown", handleEscapeToClose, true);
        };
    }, [closeWatchTogether, isOpen]);

    // attach listeners to handle the queue element menus
    useEffect(() => {
        if (openQueueMenuIndex === null) {
            return;
        }

        const closeQueueMenu = () => {
            setOpenQueueMenuIndex(null);
            setQueueMenuPosition(null);
        };

        const handlePointerDown = (event) => {
            // return if the current node is a descendant of the queue menu, so we don't close the menu
            if (queueMenuRef.current?.contains(event.target)) {
                return;
            }

            closeQueueMenu();
        };

        // third arg true means lsitener is registered in the capture phase (not the default bubble phase)
        // capture lets the window listener catch scroll events from nested scrollable elements too
        window.addEventListener("pointerdown", handlePointerDown, true);
        window.addEventListener("scroll", closeQueueMenu, true);
        window.addEventListener("resize", closeQueueMenu);

        return () => {
            window.removeEventListener("pointerdown", handlePointerDown, true);
            window.removeEventListener("scroll", closeQueueMenu, true);
            window.removeEventListener("resize", closeQueueMenu);
        };
    }, [openQueueMenuIndex]);

    // close the preset dropdown when clicking outside or when viewport changes
    useEffect(() => {
        if (!isPresetDropdownOpen) {
            return;
        }

        const closePresetDropdown = () => {
            setIsPresetDropdownOpen(false);
        };

        const handlePointerDown = (event) => {
            if (presetDropdownRef.current?.contains(event.target)) {
                return;
            }

            closePresetDropdown();
        };

        window.addEventListener("pointerdown", handlePointerDown, true);
        window.addEventListener("scroll", closePresetDropdown, true);
        window.addEventListener("resize", closePresetDropdown);

        return () => {
            window.removeEventListener("pointerdown", handlePointerDown, true);
            window.removeEventListener("scroll", closePresetDropdown, true);
            window.removeEventListener("resize", closePresetDropdown);
        };
    }, [isPresetDropdownOpen]);

    // short mute window for Youtube event callbacks
    // When we programmatically apply server state (loadVideoById, cueVideoById, seekTo, pauseVideo, etc.), the player fires onStateChange/onPlaybackRateChange events. 
    // Without suppression, those callbacks would re-emit commands (watchPlay, watchPause, watchSetRate) back to the server, causing feedback loops and noisy duplicate updates.
    const suppressPlayerEvents = useCallback((durationMs = 500) => {
        suppressPlayerEventsRef.current = true;

        // if suppress player events timeout exists and we want to suppress is again, clear it to allow for a new timeout to be set
        if (suppressPlayerEventsTimeoutRef.current) {
            window.clearTimeout(suppressPlayerEventsTimeoutRef.current);
        }

        // set a timeout for when we want to stop suppressing player events
        suppressPlayerEventsTimeoutRef.current = window.setTimeout(() => {
            suppressPlayerEventsRef.current = false;
            suppressPlayerEventsTimeoutRef.current = null;
        }, durationMs);
    }, []);

    // read zustand state and apply volume to player
    const applyLocalPlayerVolume = useCallback(() => {
        if (!playerRef.current || !playerReadyRef.current) {
            return;
        }

        suppressVolumePollUntilTsRef.current = Date.now() + WATCH_VOLUME_APPLY_SUPPRESS_MS;

        const parsedVolume = Number(watchVolume);
        const safeVolume = Number.isFinite(parsedVolume)
            ? Math.max(WATCH_VOLUME_MIN, Math.min(WATCH_VOLUME_MAX, Math.round(parsedVolume)))
            : WATCH_VOLUME_MAX;

        playerRef.current.setVolume?.(safeVolume);

        if (watchMuted || safeVolume <= 0) {
            playerRef.current.mute?.();
            return;
        }

        playerRef.current.unMute?.();
    }, [watchMuted, watchVolume]);

    const syncPlayerToWatchState = useCallback(() => {
        if (!playerRef.current || !playerReadyRef.current || !currentVideoId) {
            return;
        }

        const player = playerRef.current;
        const loadedVideoId = String(player.getVideoData?.()?.video_id ?? "");
        
        // get server authoritative effectiveWatchTimeSec
        const effectiveTimeSec = getEffectiveWatchTimeSec({
            playbackStatus,
            playbackRate,
            anchorTimeSec,
            anchorServerTsMs,
        });
        const safeEffectiveTimeSec = Number.isFinite(effectiveTimeSec) ? Math.max(0, effectiveTimeSec) : 0;

        const currentPlayerRate = Number(player.getPlaybackRate?.() ?? 1);
        const currentPlayerTime = Number(player.getCurrentTime?.() ?? 0);
        const currentPlayerState = Number(player.getPlayerState?.());

        // currentVideoId is the current video id according to the server authoritative state
        // this happens when video is changed from the currently loaded one
        if (loadedVideoId !== currentVideoId) {
            // suppress any player event handlers while we're updating the player due to syncPlayerToWatchState
            suppressPlayerEvents(900);

            if (playbackStatus === "playing") {
                player.loadVideoById({
                    videoId: currentVideoId,
                    startSeconds: safeEffectiveTimeSec,
                });
            } else {
                // load video without starting playback - used for pause state and don't auto-play
                player.cueVideoById({
                    videoId: currentVideoId,
                    startSeconds: safeEffectiveTimeSec,
                });
                player.pauseVideo?.(); // just in case video isn't paused when cued
            }

            if (Math.abs(currentPlayerRate - playbackRate) > 0.01) {
                player.setPlaybackRate?.(playbackRate);
            }
            return;
        }

        // handles the case where the server playbackrate is different from the current playback rate
        // note setPlaybackRate doesn't guarantee that the playback rate will change. If it does change, the onPlaybackRateChange event will fire
        if (Math.abs(currentPlayerRate - playbackRate) > 0.01) {
            suppressPlayerEvents(400);
            player.setPlaybackRate?.(playbackRate);
        }

        // compare player's current time (currentPlayerTime) with server derived target time (safeEffectiveTimeSec)
        // if difference in current time and server time is big enough, then we correct the player time with seekTo
        const allowedDrift = playbackStatus === "playing" ? 0.5 : 0.1;
        if (Math.abs(currentPlayerTime - safeEffectiveTimeSec) > allowedDrift) {
            suppressPlayerEvents(450);
            player.seekTo?.(safeEffectiveTimeSec, true);
        }

        if (playbackStatus === "playing") {
            if (currentPlayerState !== window.YT.PlayerState.PLAYING) {
                suppressPlayerEvents(450);
                player.playVideo?.();
            }
            return;
        }

        // at this point, we know the status isn't playing. So if it's not already paused or cued, pause the video
        // an example is if the player state server side is buffering somehow. Mostly to handle incorrect player states
        if (currentPlayerState !== window.YT.PlayerState.PAUSED && currentPlayerState !== window.YT.PlayerState.CUED) {
            suppressPlayerEvents(450);
            player.pauseVideo?.();
        }
    }, [
        anchorServerTsMs,
        anchorTimeSec,
        currentVideoId,
        playbackRate,
        playbackStatus,
        suppressPlayerEvents,
    ]); // since syncPlayerToWatchState uses these variables in its closure, if the function didn't update when these changed, it could run with stale values and sync the player to old state

    // create the player and play the first video if the user queued videos
    useEffect(() => {
        if (!hasQueuedVideos || !playerHostRef.current || playerRef.current) {
            return;
        }

        // cancelled is set to true if component suddenly unmounts (useful while player is loading)
        let cancelled = false;

        getYoutubeIframeApi()
            .then((YT) => {
                if (cancelled || !playerHostRef.current || playerRef.current) {
                    return;
                }

                playerRef.current = new YT.Player(playerHostRef.current, {
                    width: "100%",
                    height: "100%",
                    playerVars: {
                        controls: 1,
                        disablekb: 1,
                        fs: 0,
                        playsinline: 1,
                    },
                    events: {
                        onReady: () => {
                            playerReadyRef.current = true;
                            applyLocalPlayerVolume();
                            syncPlayerToWatchState();
                        },
                        onStateChange: async (event) => {
                            // if we're currently suppressing events, dont send any emits to the server
                            if (suppressPlayerEventsRef.current || !playerRef.current) {
                                return;
                            }

                            if (event.data !== window.YT.PlayerState.ENDED) {
                                // this technically syncs seeks as well because a seek usually triggers a state transition sequence (BUFFERING, then PLAYING or PAUSED), 
                                // and the code reacts to PLAYING/PAUSED by sending current time via watchPlay/watchPause:
                                if (event.data === window.YT.PlayerState.PLAYING) {
                                    const currentTime = Number(playerRef.current.getCurrentTime?.() ?? 0);
                                    const currentRate = Number(playerRef.current.getPlaybackRate?.() ?? playbackRate);
                                    
                                    // send a play command
                                    const result = await watchPlay({
                                        timeSec: currentTime,
                                        playbackRate: currentRate,
                                    });

                                    if (!result.ok) {
                                        setPlayerError(result.message ?? "Failed to sync play state.");
                                    }
                                    return;
                                }

                                if (event.data === window.YT.PlayerState.PAUSED) {
                                    const currentTime = Number(playerRef.current.getCurrentTime?.() ?? 0);
                                    const result = await watchPause({
                                        timeSec: currentTime,
                                    });

                                    if (!result.ok) {
                                        setPlayerError(result.message ?? "Failed to sync pause state.");
                                    }
                                }

                                return;
                            }

                            // if we're here, that means the ENDED event was broadcasted
                            const previousIndex = currentQueueIndexRef.current;
                            const nextIndex = previousIndex + 1;

                            // prevIndex < 0 means no active video
                            // nextIndex >= queue.length means current video was the last element
                            // since server state only has playing/paused (no ended state),
                            // pin playback to the end time so we don't rewind everyone to 0.
                            if (previousIndex < 0 || nextIndex >= videoQueueRef.current.length) {
                                const currentTime = Number(playerRef.current.getCurrentTime?.() ?? 0);
                                const duration = Number(playerRef.current.getDuration?.() ?? 0);

                                const safeCurrentTime = Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0;
                                const safeDuration = Number.isFinite(duration) ? Math.max(0, duration) : 0;

                                // since getDuration can be 0 briefly
                                const pauseTimeSec = Math.max(safeCurrentTime, safeDuration);

                                const result = await watchPause({
                                    timeSec: pauseTimeSec,
                                });

                                if (!result.ok) {
                                    setPlayerError(result.message ?? "Failed to sync playback state.");
                                }

                                return;
                            }

                            // here if theres another video to play
                            const result = await watchSetIndex({ 
                                queueIndex: nextIndex,
                                timeSec: 0,
                            });

                            if (!result.ok) {
                                setPlayerError(result.message ?? "Failed to play next queued video.");
                            }
                        },
                        onPlaybackRateChange: async (event) => {
                            if (suppressPlayerEventsRef.current || !playerRef.current) {
                                return;
                            }

                            const nextRate = Number(event.data);
                            if (!Number.isFinite(nextRate)) {
                                return;
                            }

                            const currentTime = Number(playerRef.current.getCurrentTime?.() ?? 0);
                            const result = await watchSetRate({
                                playbackRate: nextRate,
                                timeSec: currentTime,
                            });

                            if (!result.ok) {
                                setPlayerError(result.message ?? "Failed to sync playback rate.");
                            }
                        }
                    },
                });
            })
            .catch((error) => {
                if (cancelled) {
                    return;
                }

                setPlayerError(error instanceof Error ? error.message : "Failed to load YouTube player.");
            });

        return () => {
            cancelled = true;
        };
    }, [applyLocalPlayerVolume, hasQueuedVideos, playbackRate, syncPlayerToWatchState, watchPause, watchPlay, watchSetIndex, watchSetRate]);

    // destroy the youtube player if there is nothing to play (hasQueuedVideos === false)
    useEffect(() => {
        if (hasQueuedVideos) {
            return;
        }

        if (playerRef.current) {
            playerRef.current.destroy();
            playerRef.current = null;
        }

        playerReadyRef.current = false;
    }, [hasQueuedVideos]);

    // this effect syncs the client side to the server authoritative state with syncPlayerToWatchState whenever it updates
    // syncPlayerToWatchState() is set to update when the global zustand watchTogether state updates, which happens from the socket event listener
    useEffect(() => {
        // console.log("syncing player to watch state")
        syncPlayerToWatchState();
    }, [syncPlayerToWatchState]);

    useEffect(() => {
        applyLocalPlayerVolume();
    }, [applyLocalPlayerVolume]);

    // YouTube IFrame API has no onVolumeChange event, so poll player volume/mute to capture changes from native controls.
    useEffect(() => {
        if (!hasQueuedVideos) {
            return;
        }

        const intervalId = window.setInterval(() => {
            if (!playerRef.current || !playerReadyRef.current) {
                return;
            }

            if (Date.now() < suppressVolumePollUntilTsRef.current) {
                return;
            }

            const playerVolume = Number(playerRef.current.getVolume?.());
            if (!Number.isFinite(playerVolume)) {
                return;
            }

            const safeVolume = Math.max(WATCH_VOLUME_MIN, Math.min(WATCH_VOLUME_MAX, Math.round(playerVolume)));
            const isMuted = Boolean(playerRef.current.isMuted?.());
            const nextMuted = isMuted || safeVolume <= 0;

            if (safeVolume !== localWatchVolumeRef.current) {
                setWatchVolume(safeVolume);
            }

            if (nextMuted !== localWatchMutedRef.current) {
                setWatchMuted(nextMuted);
            }
        }, WATCH_VOLUME_POLL_INTERVAL_MS);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [hasQueuedVideos, setWatchMuted, setWatchVolume]);

    // handle player cleanup when component unmounts
    useEffect(() => {
        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }

            playerReadyRef.current = false;
            suppressPlayerEventsRef.current = false;
            if (suppressPlayerEventsTimeoutRef.current) {
                window.clearTimeout(suppressPlayerEventsTimeoutRef.current);
                suppressPlayerEventsTimeoutRef.current = null;
            }
        };
    }, []);

    const handleQueueVideo = useCallback((video) => {
        if (!video?.videoId) {
            return;
        }

        setPlayerError("");
        void (async () => {
            const response = await watchQueueAdd(video);
            if (!response.ok) {
                setPlayerError(response.message ?? "Failed to add video to queue.");
            }
        })();
    }, [watchQueueAdd]);

    const handleQueueItemClick = useCallback((queueIndex) => {
        const safeQueueIndex = Number(queueIndex);
        if (!Number.isInteger(safeQueueIndex)) {
            return;
        }

        if (safeQueueIndex < 0 || safeQueueIndex >= videoQueueRef.current.length) {
            return;
        }

        setPlayerError("");
        void (async () => {
            const response = await watchSetIndex({
                queueIndex: safeQueueIndex,
                timeSec: 0,
            });

            if (!response.ok) {
                setPlayerError(response.message ?? "Failed to change queued video.");
            }
        })();
    }, [watchSetIndex]);

    const handleQueueMenuToggle = useCallback((queueIndex, anchorElement) => {
        const safeQueueIndex = Number(queueIndex);
        if (!Number.isInteger(safeQueueIndex)) {
            return;
        }

        if (!(anchorElement instanceof HTMLElement)) {
            return;
        }

        if (openQueueMenuIndex === safeQueueIndex) {
            setOpenQueueMenuIndex(null);
            setQueueMenuPosition(null);
            return;
        }

        // position the queue menu relative to the given anchorElement
        const anchorRect = anchorElement.getBoundingClientRect();
        setQueueMenuPosition({
            left: anchorRect.left,
            top: anchorRect.top,
        });
        setOpenQueueMenuIndex(safeQueueIndex);

    }, [openQueueMenuIndex]);

    const handleQueueItemDelete = useCallback((queueIndex) => {
        const safeQueueIndex = Number(queueIndex);
        if (!Number.isInteger(safeQueueIndex)) {
            return;
        }

        setPlayerError("");
        void (async () => {
            const response = await watchQueueRemove(safeQueueIndex);
            if (!response.ok) {
                setPlayerError(response.message ?? "Failed to remove video from queue.");
                return;
            }

            setOpenQueueMenuIndex(null);
            setQueueMenuPosition(null);
        })();
    }, [watchQueueRemove]);

    const executeSearch = useCallback(async ({ query, presetValue }) => {
        const safeQuery = String(query ?? "").trim();
        const selectedPreset = String(presetValue ?? DEFAULT_PRESET).trim() || DEFAULT_PRESET;
        const requestId = latestSearchRequestIdRef.current + 1;
        latestSearchRequestIdRef.current = requestId;

        setIsSearching(true);
        setSearchError("");

        // run with preset first, then with query as link, then with query as search query
        try {
            if (!safeQuery) {
                const response = await fetch(`${SERVER_BASE_URL}/api/youtube/preset?kind=${selectedPreset}`);
                const payload = await response.json().catch(() => null);

                if (!response.ok) {
                    const errorMessage = String(payload?.message ?? "Failed to fetch preset videos.");
                    throw new Error(errorMessage);
                }
                
                const safeItems = Array.isArray(payload?.items) ? payload.items : [];

                if (requestId !== latestSearchRequestIdRef.current) {
                    return;
                }

                setActivePreset(selectedPreset);
                setSearchResults(safeItems);
                return;
            }            

            const pastedVideoId = extractYoutubeVideoId(safeQuery);
            if (pastedVideoId) {
                const response = await fetch(`${SERVER_BASE_URL}/api/youtube/video?videoId=${encodeURIComponent(pastedVideoId)}`);
                const payload = await response.json().catch(() => null);

                if (!response.ok) {
                    const errorMessage = String(payload?.message ?? "Failed to fetch YouTube video.");
                    throw new Error(errorMessage);
                }

                const videoItem = payload?.item ?? null;
                if (!videoItem?.videoId) {
                    throw new Error("No YouTube video found for that link.");
                }

                if (requestId !== latestSearchRequestIdRef.current) {
                    return;
                }
                setActivePreset(null);
                setSearchResults([videoItem]);
                return;
            }

            let payload;

            // if no video id extracted from input, we then try searching with youtube search list
            const response = await fetch(`${SERVER_BASE_URL}/api/youtube/search?q=${encodeURIComponent(safeQuery)}`);
            payload = await response.json().catch(() => null);

            if (!response.ok) {
                const errorMessage = String(payload?.message ?? "Failed to fetch YouTube videos.");
                throw new Error(errorMessage);
            }

            const safeItems = Array.isArray(payload.items) ? payload.items : [];
            if (requestId !== latestSearchRequestIdRef.current) {
                return;
            }

            setActivePreset(null);
            setSearchResults(safeItems);
        } catch (error) {
            if (requestId !== latestSearchRequestIdRef.current) {
                return;
            }
            setSearchResults([]);
            setSearchError(error instanceof Error ? error.message : "Failed to fetch YouTube videos.");
            setActivePreset(null);
        } finally {
            // this is to prevent an old request from turning off the loading state of a newer one
            // in other words, it only lets the latest request cotrol isSearching
            if (requestId === latestSearchRequestIdRef.current) {
                setIsSearching(false);
            }
        }
    }, []);

    // execute the search for the default preset on watch together open
    useEffect(() => {
        if (!isOpen || hasInitializedDefaultRef.current) {
            return;
        }

        hasInitializedDefaultRef.current = true;
        void executeSearch({
            query: "",
            presetValue: DEFAULT_PRESET,
        });
    }, [isOpen, executeSearch]);

    const handleClearSearch = useCallback(() => {
        latestSearchRequestIdRef.current += 1; // invalidate in-flight searches
        setSearchInput("");
        setSearchError("");
        setIsPresetDropdownOpen(false);

        void executeSearch({
            query: "",
            presetValue: DEFAULT_PRESET,
        });
    }, [executeSearch]);

    const handleSubmit = (event) => {
        event.preventDefault();
        if (isSearching) {
            return;
        }

        void executeSearch({
            query: searchInput,
        });
    };

    const handlePresetChange = (presetValue) => {
        const nextPresetValue = String(presetValue ?? DEFAULT_PRESET).trim() || DEFAULT_PRESET;
        setSearchInput("");
        setIsPresetDropdownOpen(false);

        // void just says "call this expression, but intentionally ignore its return value"
        void executeSearch({ 
            query: "",
            presetValue: nextPresetValue,
        });
    }

    const handleClose = () => {
        closeWatchTogether();
    };

    // since input keystrokes update component state, we don't want to rerender the entire search results
    // without useMemo, every render rebuilds all result card JSX with map() even when searchResults didn't change
    const renderedSearchResults = useMemo(() => {
        return searchResults.map((video) => (
            <li key={video.videoId} className="h-full">
                <button
                    type="button"
                    onClick={() => handleQueueVideo(video)}
                    className="group w-full h-full flex items-start text-left rounded-lg border border-white/10 bg-white/3 p-2 
                        hover:bg-white/7 transition-colors cursor-pointer"
                >
                    <div className="flex flex-col gap-2 w-full">
                        <div className="relative w-full aspect-video rounded-md overflow-hidden">
                            {video.thumbnailUrl ? (
                                <img
                                    className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                                    src={video.thumbnailUrl}
                                    alt={video.title || "YouTube thumbnail"}
                                    loading="lazy" // tells browser to delay loading this image until it's near the viewport instead of loading immediately
                                    draggable={false}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[11px] bg-black/40 text-white/60">
                                    No thumbnail
                                </div>
                            )}
                            <div className="pointer-events-none absolute inset-0 z-10 bg-black/0 opacity-0 transition-all duration-300 ease-out group-hover:bg-black/45 group-hover:opacity-100">
                                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full 
                                      bg-primary/20 border border-primary/65 
                                        text-3xl leading-none font-medium text-white transition-transform duration-300 ease-out scale-90 group-hover:scale-100">
                                    +
                                </span>
                                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-4 text-xs tracking-wide uppercase text-white 
                                    transition-all duration-300 ease-out group-hover:translate-y-5">
                                    Add to queue
                                </span>
                            </div>
                            {formatVideoDuration(video.duration) && (
                                <span className="absolute z-20 right-1 bottom-1 rounded bg-black/80 px-1 py-0.5 text-xs leading-none text-white">
                                    {formatVideoDuration(video.duration)}
                                </span>
                            )}
                        </div>

                        <div className="min-w-0">
                            <p className="text-sm font-medium leading-5 max-h-10 overflow-hidden">
                                {video.title || "Untitled video"}
                            </p>
                            <p className="mt-1 text-xs text-white/75 truncate">
                                {video.channelTitle || "Unknown channel"}
                            </p>
                            <p className="mt-1 text-xs text-white/60">
                                {formatViews(video.viewCount)} • {formatPublishedAgo(video.publishedAt)}
                            </p>
                        </div>
                    </div>
                </button>
            </li>
        ));
    }, [handleQueueVideo, searchResults]);

    const renderedQueueItems = useMemo(() => {
        return videoQueue.map((video, queueIndex) => {
            const isNowPlaying = queueIndex === currentQueueIndex;

            return (
                <li 
                    key={`${video.videoId}-${queueIndex}`}
                    className="relative group"
                >
                    <div
                        className={`flex flex-row items-center p-2 pl-0 border rounded-lg transition-colors ${
                            isNowPlaying
                                    ? "border-primary/70 bg-primary/12 hover:bg-primary/16 active:bg-primary/8"
                                    : "border-white/10 bg-white/3 hover:bg-white/7 active:bg-white/5"
                    }`}
                    >
                        {/* queue index */}
                        <p className="w-6 shrink-0 text-center text-xs tabular-nums text-white/75 select-none">
                            {queueIndex + 1}
                        </p>

                        {/* video info */}
                        <button
                            type="button"
                            onClick={() => handleQueueItemClick(queueIndex)}
                            className={`w-full pr-7 text-left hover:cursor-pointer`}
                        >
                            <div className="flex flex-row gap-3 h-20">
                                <div className="relative h-full shrink-0 overflow-hidden rounded-md bg-black/40 aspect-video">
                                    {video.thumbnailUrl ? (
                                        <img
                                            className="w-full h-full object-cover"
                                            src={video.thumbnailUrl}
                                            alt={video.title || "Queue thumbnail"}
                                            loading="lazy" // tells browser to delay loading this image until it's near the viewport instead of loading immediately
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[11px] text-white/60">
                                            No thumbnail
                                        </div>
                                    )}
                                    {formatVideoDuration(video.duration) && (
                                        <span className="absolute z-20 right-1 bottom-1 rounded bg-black/80 px-1 py-0.5 text-xs leading-none text-white">
                                            {formatVideoDuration(video.duration)}
                                        </span>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium leading-5 line-clamp-2">
                                        {video.title || "Untitled video"}
                                    </p>
                                    <p className="mt-1 text-xs text-white/75 truncate">
                                        {video.channelTitle || "Unknown channel"}
                                    </p>
                                    {/* <p className="mt-1 text-xs text-white/60 truncate">
                                        {formatViews(video.viewCount)} • {formatPublishedAgo(video.publishedAt)}
                                    </p> */}
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* queue element menu toggle */}
                    <div className="absolute right-2 top-2">
                        <button
                            type="button"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleQueueMenuToggle(queueIndex, event.currentTarget);
                            }}
                            onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                            aria-haspopup="menu" // tells screen readers this button opens a menu
                            aria-expanded={openQueueMenuIndex === queueIndex} // tells screen reader whether the menu is currently open or closed
                            aria-label={`Queue actions for video ${queueIndex + 1}`}
                            className={`flex items-center justify-center h-7 w-7 rounded-[14px] border bg-gray-400/20 border-gray-300/20 text-sm leading-none transition-all
                                cursor-pointer hover:bg-gray-300/30 hover:border-gray-200/50 active:bg-gray-500/30 active:border-gray-400/30
                            ${
                                openQueueMenuIndex === queueIndex
                                    ? "opacity-100"
                                    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                            }`}
                        >
                            •••
                        </button>
                    </div>
                </li>
            );
        });
    }, [currentQueueIndex, handleQueueItemClick, handleQueueMenuToggle, openQueueMenuIndex, videoQueue]);

    const searchContent = (
        <>
            {isSearching && (
                <p className="text-sm text-white/70">Searching...</p>
            )}

            {!isSearching && searchError && (
                <p className="text-sm text-red-300">{searchError}</p>
            )}

            {!isSearching && !searchError && searchResults.length === 0 && (
                <p className="text-sm text-white/70">No videos found</p>
            )}

            {!isSearching && !searchError && searchResults.length > 0 && (
                <>
                    {activePresetObj ? (
                        <p className="mb-2 flex flex-row items-center gap-1 font-medium text-xs xs:text-sm text-white/70">
                            <activePresetObj.IconComponent className={`${activePresetObj.iconClassName} h-4 w-4 xs:h-5 xs:w-5`}/>
                            <span className={`inline-block ${activePresetObj.textStyle}`}>
                                {activePresetObj.label}
                            </span>
                        </p>
                    ) : null}

                    <ul className={`grid gap-3 ${hasQueuedVideos ? "grid-cols-2 xs:grid-cols-1 md:grid-cols-2" : "grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}>
                        {renderedSearchResults}
                    </ul>
                </>
            )}
        </>
    );

    return (
        <div
            className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-200 ease-out ${
                isOpen ? "pointer-events-auto opacity-100 bg-[rgba(16,16,16,0.3)]" : "pointer-events-none opacity-0 bg-[rgba(16,16,16,0)]"
            }`}
        >
            <section
                ref={panelRef}
                className={`relative flex flex-col w-[min(95vw,70rem)] h-[98vh] xs:h-[min(80vh,40rem)] rounded-lg border border-white/15 bg-[rgba(41,41,41,0.9)] p-4 text-white shadow-2xl transition-all duration-200 ease-out ${
                    isOpen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
            >
                {/* headers and inputs */}
                <div className="grid items-center gap-3
                    grid-cols-[minmax(0,1fr)_auto]
                    sm:grid-cols-[auto_minmax(9.5rem,1fr)_auto]
                    lg:grid-cols-[clamp(10rem,16vw,12rem)_minmax(9.5rem,1fr)_clamp(1.5rem,16vw,12rem)]"
                >
                    {/* title */}
                    <div className="row-start-1 col-start-1 flex flex-row gap-1 items-center whitespace-nowrap">
                        <img className="w-9 h-9" src={ShibaInuFace} alt="Shiba Inu logo" />
                        <p className="text-sm truncate">Watch_3_Gether</p>
                    </div>

                    {/* inputs */}
                    <div className="row-start-2 col-start-1 col-span-2 sm:row-start-1 sm:col-start-2 sm:col-span-1 font-['Roboto'] flex flex-col gap-2 w-full
                        min-w-0 justify-center items-stretch xs:flex-row xs:items-center"
                    >
                        {/* search input */}
                        <form 
                            onSubmit={handleSubmit}
                            className="relative w-full max-w-120 flex flex-row items-stretch"
                        >
                            <input 
                                type="text" 
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                className="w-full p-2.5 pr-8.5 text-xs rounded-l-full rounded-r-none bg-[rgba(41,41,41,0.8)] border border-white/30 outline-none
                                     focus:border-primary transition-colors duration-100 ease-out"
                                placeholder="Search or paste Youtube URL"
                            />
                            
                            {searchInput.length > 0 &&
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    className="absolute top-1/2 -translate-y-1/2 right-14"
                                    onClick={handleClearSearch}
                                >
                                    <CloseIcon className="w-6 h-6 cursor-pointer"/>
                                </button>
                            }
                            

                            <button 
                                type="submit"
                                disabled={isSearching}
                                aria-label="Search videos"
                                className="hover:cursor-pointer w-14 bg-[rgba(94,94,94,0.6)] border-t border-r border-b border-white/30 rounded-r-full rounded-l-none flex items-center justify-center
                                    transition-colors duration-100 hover:bg-[rgba(94,94,94,0.8)] active:bg-[rgba(94,94,94,0.6)]"
                            >
                                <SearchIcon className="h-4 w-4 -translate-x-1"/>
                            </button>
                        </form>

                        {/* preset options */}
                        <div ref={presetDropdownRef} className="relative w-full xs:w-37 shrink-0">
                            {/* preset trigger */}
                            <button 
                                type="button"
                                aria-haspopup="menu"
                                aria-expanded={isPresetDropdownOpen}
                                aria-controls="watch-together-preset-menu" // links a control element to the element it controls
                                className="w-full flex flex-row items-center justify-between gap-1 px-2.5 py-1.5 xs:py-2 rounded-full border border-white/30 bg-[rgba(41,41,41,0.7)] text-xs xs:text-sm
                                    cursor-pointer hover:border-white/40 hover:bg-[rgba(60,60,60,0.7)] active:border-white/50 active:bg-[rgba(64,64,64,0.7)] transition-colors"
                                onClick={() => {
                                    setIsPresetDropdownOpen((prev) => !prev);
                                }}
                            >
                                <span className="min-w-0 flex items-center">
                                    <p className="truncate text-left text-white">Browse Presets</p>
                                </span>
                                <ExpandMoreIcon 
                                    className={`shrink-0 ${isPresetDropdownOpen ? "rotate-180" : "rotate-0"} transition-transform duration-100`}
                                />
                            </button>

                            {/* options */}
                            <div 
                                id="watch-together-preset-menu"
                                role="menu"
                                aria-hidden={!isPresetDropdownOpen}
                                className={`absolute z-40 top-[calc(100%+2px)] left-0 w-full xs:w-max xs:min-w-44 xs:max-w-80 max-w-[90vw] flex flex-col items-start rounded-lg shadow-lg bg-[#202020] transition-all
                                ${isPresetDropdownOpen ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0 pointer-events-none"}
                                overflow-hidden`}
                            >
                                {PRESET_OPTIONS.map((presetObj) => {
                                    const PresetIcon = presetObj.IconComponent;
                                    return (    
                                        <button 
                                            key={presetObj.value}
                                            type="button"
                                            role="menuitem"
                                            tabIndex={isPresetDropdownOpen ? 0 : -1}
                                            className="flex flex-row w-full items-center gap-1 px-2.5 py-2 text-xs sm:text-sm whitespace-nowrap
                                                first:rounded-t-lg last:rounded-b-lg cursor-pointer hover:bg-[rgba(60,60,60,1)] active:bg-[rgba(64,64,64,1)] transition-colors"
                                            onClick={() => {
                                                handlePresetChange(presetObj.value)
                                            }}
                                        >
                                            <PresetIcon className={`${presetObj.iconClassName} h-6 w-6`} />
                                            <p className={`text-left ${presetObj.textStyle}`}>{presetObj.label}</p>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* close */}
                    <button 
                        type="button"
                        className="row-start-1 col-start-2 sm:col-start-3 w-6 h-auto justify-self-end hover:cursor-pointer 
                            transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-100 hover:opacity-95 active:opacity-90"
                        onMouseDown={(event) => event.preventDefault()} // prevent close button from taking mouse focus
                        onClick={handleClose}
                    >
                        <CloseIcon />
                    </button>
                </div>

                {/* if queuedVideos, left side player + queue - right side search results. Else, all search results */}
                {hasQueuedVideos ? (
                    <div className="font-['Roboto'] mt-2 flex-1 min-h-0 grid grid-cols-1 grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-4 xs:grid-cols-[minmax(20rem,2fr)_minmax(0,3fr)] xs:grid-rows-1">
                        {/* player + queue */}
                        <div className="min-h-0 flex flex-col">
                            <div className="w-full shrink-0 overflow-hidden rounded-xl border border-white/20 bg-black aspect-video">
                                <div ref={playerHostRef} className="w-full h-full" />
                            </div>

                            {playerError ? (
                                <p className="mt-2 text-sm text-red-300">{playerError}</p>
                            ) : null}

                            {/* queue */}
                            <div className="mt-2 xs:mt-3 flex items-center justify-between gap-3">
                                <p className="text-xs xs:text-sm font-medium text-white/90">Shared Queue</p>
                                <p className="text-[10px] tracking-wide text-white/60">Video {currentQueueIndex + 1}/{videoQueue.length}</p>
                            </div>

                            <div className="mt-2 flex-1 overflow-y-auto pr-1 app-scroll">
                                <ul className="flex flex-col gap-2">
                                    {renderedQueueItems}
                                </ul>
                            </div>
                        </div>

                        {/* search content */}
                        <div className="min-h-0 mt-0 xs:mt-1 overflow-y-auto pr-1 app-scroll">
                            {isOpen ? searchContent : null}
                        </div>
                    </div>
                ) : (
                    // search content
                    <div className="font-['Roboto'] mt-2 flex-1 min-h-0 overflow-y-auto pr-1 app-scroll">
                        {isOpen ? searchContent : null}
                    </div>
                )}
            </section>

            {isOpen && openQueueMenuIndex !== null && queueMenuPosition && typeof document !== "undefined"
                ? createPortal(
                    <div
                        ref={queueMenuRef}
                        className="font-['Roboto'] fixed z-50 min-w-40 overflow-hidden rounded-[14px] border border-white/15 bg-[rgba(22,22,22,0.95)] shadow-lg
                            "
                        style={{
                            left: `${queueMenuPosition.left}px`,
                            top: `${queueMenuPosition.top}px`,
                        }}
                    >
                        <button
                            type="button"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleQueueItemDelete(openQueueMenuIndex);
                            }}
                            className="flex flex-row gap-2 w-full px-3 py-2 text-left text-md text-white transition-colors hover:bg-red-500/15 hover:text-red-100
                                hover:cursor-pointer"
                        >
                            <DeleteIcon className="w-6 h-6"/>
                            <p>Delete</p>
                        </button>
                    </div>,
                    document.body
                )
                : null}
        </div>
    );
};

export default WatchTogetherInterface
