import { useEffect, useRef, useState } from "react";

import { useGameStore } from "../store/useGameStore.js";
import { getEffectiveWatchTimeSec } from "../lib/watchTogetherHelpers.js";

import PauseIcon from "../assets/icons/pause.svg?react"
import PlayIcon from "../assets/icons/play_arrow.svg?react";
import PlaybackRateIcon from "../assets/icons/playback_rate.svg?react";
import SkipPreviousIcon from "../assets/icons/skip_previous.svg?react";
import SkipNextIcon from "../assets/icons/skip_next.svg?react";
import VolumeOffIcon from "../assets/icons/volume_off.svg?react";
import VolumeMuteIcon from "../assets/icons/volume_mute.svg?react";
import VolumeMediumIcon from "../assets/icons/volume_medium.svg?react";
import VolumeHighIcon from "../assets/icons/volume_high.svg?react";


const PLAYBACK_BUTTON_CLASS =
    "cursor-pointer select-none transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-100 hover:opacity-95 active:opacity-90 disabled:cursor-auto disabled:opacity-45";

const PLAYBACK_RATES = Object.freeze([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]);
const MIN_PLAYBACK_RATE = PLAYBACK_RATES[0];
const MAX_PLAYBACK_RATE = PLAYBACK_RATES[PLAYBACK_RATES.length - 1];
const PLAYBACK_RATE_STEP = 0.25;
const MIN_VOLUME = 0;
const MAX_VOLUME = 100;
const VOLUME_STEP = 1;

const toNearestPlaybackRate = (rate) => {
    const parsedRate = Number(rate);
    if (!Number.isFinite(parsedRate)) {
        return 1;
    }

    return PLAYBACK_RATES.reduce((closestRate, candidateRate) => {
        return Math.abs(candidateRate - parsedRate) < Math.abs(closestRate - parsedRate)
            ? candidateRate
            : closestRate;
    }, PLAYBACK_RATES[0]);
};

const PlaybackControls = ({ outerClassName }) => {
    const watchTogether = useGameStore((state) => state.watchTogether);
    const watchVolume = useGameStore((state) => state.watchVolume);
    const watchMuted = useGameStore((state) => state.watchMuted);

    const watchPlay = useGameStore((state) => state.watchPlay);
    const watchPause = useGameStore((state) => state.watchPause);
    const watchSetIndex = useGameStore((state) => state.watchSetIndex);
    const watchSetRate = useGameStore((state) => state.watchSetRate);
    const setWatchVolume = useGameStore((state) => state.setWatchVolume);
    const setWatchMuted = useGameStore((state) => state.setWatchMuted);
    const pushToast = useGameStore((state) => state.pushToast);

    const videoQueue = Array.isArray(watchTogether.queue) ? watchTogether.queue : [];
    const currentQueueIndex = Number.isInteger(watchTogether.currentQueueIndex) ? watchTogether.currentQueueIndex : -1;
    const playbackStatus = String(watchTogether.playbackStatus ?? "paused").toLowerCase() === "playing" ? "playing" : "paused";
    const playbackRate = Number.isFinite(Number(watchTogether.playbackRate)) ? Number(watchTogether.playbackRate) : 1;
    const hasQueuedVideos = videoQueue.length > 0;
    const canGoToPrevious = hasQueuedVideos && currentQueueIndex > 0;
    const canGoToNext = hasQueuedVideos && currentQueueIndex >= 0 && currentQueueIndex < (videoQueue.length - 1);

    const rateControlRef = useRef(null);
    const volumeControlRef = useRef(null);
    const volumePointerIsTouchRef = useRef(false);
    const lastNonZeroVolumeRef = useRef(Math.max(1, Number(watchVolume) || 100));

    const [showRatePopup, setShowRatePopup] = useState(false);
    const [ratePopupToggled, setRatePopupToggled] = useState(false);
    const [showVolumePopup, setShowVolumePopup] = useState(false);
    const [volumePopupToggled, setVolumePopupToggled] = useState(false);
    const [sliderRate, setSliderRate] = useState(toNearestPlaybackRate(playbackRate));

    // sync server state
    useEffect(() => {
        setSliderRate(toNearestPlaybackRate(playbackRate));
    }, [playbackRate]);

    // everytime the global store has a change in watchVolume, set lastNonZeroVolumeRef to this
    useEffect(() => {
        if (!watchMuted && watchVolume > 0) {
            lastNonZeroVolumeRef.current = watchVolume;
        }
    }, [watchMuted, watchVolume]);

    useEffect(() => {
        if (!ratePopupToggled) {
            return;
        }

        const handleOutsidePointerDown = (event) => {
            if (!(event.target instanceof Node)) {
                return;
            }

            if (rateControlRef.current?.contains(event.target)) {
                return;
            }

            setRatePopupToggled(false);
            setShowRatePopup(false);
        };

        document.addEventListener("pointerdown", handleOutsidePointerDown);

        return () => {
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
        };
    }, [ratePopupToggled]);

    useEffect(() => {
        if (!volumePopupToggled) {
            return;
        }

        const handleOutsidePointerDown = (event) => {
            if (!(event.target instanceof Node)) {
                return;
            }

            if (volumeControlRef.current?.contains(event.target)) {
                return;
            }

            setVolumePopupToggled(false);
            setShowVolumePopup(false);
        };

        document.addEventListener("pointerdown", handleOutsidePointerDown);

        return () => {
            document.removeEventListener("pointerdown", handleOutsidePointerDown);
        };
    }, [volumePopupToggled]);

    const getCurrentSyncTimeSec = () => {
        return getEffectiveWatchTimeSec(watchTogether);
    };

    const handlePlayPause = async () => {
        if (!hasQueuedVideos) {
            return;
        }

        const timeSec = getCurrentSyncTimeSec();
        const response = playbackStatus === "playing"
            ? await watchPause({ timeSec })
            : await watchPlay({ timeSec, playbackRate });

        if (!response.ok) {
            pushToast(response.message ?? "Failed to update playback.", {
                type: "error",
            });
        }
    };

    const handleGoToPrevious = async () => {
        if (!canGoToPrevious) {
            return;
        }

        const response = await watchSetIndex({
            queueIndex: currentQueueIndex - 1,
            timeSec: 0,
        });

        if (!response.ok) {
            pushToast(response.message ?? "Failed to play previous video.", {
                type: "error",
            });
        }
    };

    const handleGoToNext = async () => {
        if (!canGoToNext) {
            return;
        }

        const response = await watchSetIndex({
            queueIndex: currentQueueIndex + 1,
            timeSec: 0,
        });

        if (!response.ok) {
            pushToast(response.message ?? "Failed to play next video.", {
                type: "error",
            });
        }
    };

    const handlePlaybackRateChange = async (event) => {
        if (!hasQueuedVideos) {
            return;
        }

        const nextRate = toNearestPlaybackRate(event.target.value);
        setSliderRate(nextRate);

        if (Math.abs(nextRate - playbackRate) < 0.001) {
            return;
        }

        const response = await watchSetRate({
            playbackRate: nextRate,
            timeSec: getCurrentSyncTimeSec(),
        });

        if (!response.ok) {
            setSliderRate(toNearestPlaybackRate(playbackRate)); // to avoid showing value that didn't actually apply
            pushToast(response.message ?? "Failed to update playback rate.", {
                type: "error",
            });
        }
    };

    const handleVolumeChange = (event) => {
        const parsedVolume = Number(event.target.value);
        const nextVolume = Number.isFinite(parsedVolume)
            ? Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, Math.round(parsedVolume)))
            : MAX_VOLUME;

        setWatchVolume(nextVolume);
        setWatchMuted(nextVolume <= 0);

        if (nextVolume > 0) {
            lastNonZeroVolumeRef.current = nextVolume;
        }
    };

    const handleToggleMuted = () => {
        if (watchMuted || watchVolume <= 0) { // if muted, unmute at last nonzero volume set
            const restoredVolume = Math.max(1, Math.min(MAX_VOLUME, lastNonZeroVolumeRef.current || 50));
            setWatchVolume(restoredVolume);
            setWatchMuted(false);
            return;
        }

        lastNonZeroVolumeRef.current = watchVolume;
        setWatchMuted(true);
    };

    const VolumeIconComponent = watchMuted
        ? VolumeOffIcon
        : watchVolume <= 33
            ? VolumeMuteIcon
            : watchVolume <= 66
                ? VolumeMediumIcon
                : VolumeHighIcon;

    return (
        <div className={`w-fit rounded-full flex flex-row items-center justify-center gap-4 px-4 py-1.25 bg-[rgba(25,25,25,0.7)] backdrop-blur-sm ${outerClassName}`}>
            <div
                className="flex relative items-center"
                ref={rateControlRef}
                onMouseEnter={() => {
                    if (hasQueuedVideos) {
                        setShowRatePopup(true);
                    }
                }}
                onMouseLeave={() => {
                    setShowRatePopup(false);
                }}
            >
                <button
                    type="button"
                    aria-label="Configure playback rate"
                    title={`Playback rate: ${playbackRate}x`}
                    disabled={!hasQueuedVideos}
                    className={PLAYBACK_BUTTON_CLASS}
                    onClick={(e) => {
                        e.currentTarget.blur();
                        if (hasQueuedVideos) {
                            setRatePopupToggled((prev) => {
                                const next = !prev;
                                if (!next) { // if we're toggling off
                                    setShowRatePopup(false);
                                }
                                return next;
                            });
                        }
                    }}
                >
                    <PlaybackRateIcon className="w-8 sm:w-10 h-auto" />
                </button>

                
                <div className={`${((showRatePopup || ratePopupToggled) && hasQueuedVideos) ? "opacity-100" : "pointer-events-none opacity-0"} 
                    flex flex-col items-center w-12 gap-2 absolute left-1/2 bottom-full -translate-x-1/2 rounded-full ${ratePopupToggled && hasQueuedVideos ? "bg-[rgba(25,25,25,0.7)]" : "bg-[rgba(25,25,25,0.4)]"}  
                    x-2 py-3 shadow-lg backdrop-blur-sm transition-opacity`}
                >
                    <div className="text-center text-xs text-white/85 tabular-nums">
                        {sliderRate.toFixed(2).replace(/\.00$/, "")}x
                    </div>

                    <div className="flex h-24 w-8 items-center justify-center">
                        <input
                            type="range"
                            min={MIN_PLAYBACK_RATE}
                            max={MAX_PLAYBACK_RATE}
                            step={PLAYBACK_RATE_STEP}
                            value={sliderRate}
                            onChange={(event) => {
                                void handlePlaybackRateChange(event);
                            }}
                            className="w-24 h-2 cursor-pointer accent-white -rotate-90"
                            aria-label="Playback rate slider"
                        />
                    </div>
                </div>
                    
            </div>

            <div className="flex flex-row">
                <button
                    type="button"
                    aria-label="Go to previous video"
                    disabled={!canGoToPrevious}
                    className={`${PLAYBACK_BUTTON_CLASS}`}
                    onClick={(e) => {
                        e.currentTarget.blur();
                        void handleGoToPrevious();
                    }}
                >
                    <SkipPreviousIcon className="w-8 sm:w-10 h-auto" />
                </button>

                {playbackStatus === "paused" ?
                    <button
                        type="button"
                        aria-label="Play video"
                        disabled={!hasQueuedVideos}
                        className={`${PLAYBACK_BUTTON_CLASS}`}
                        onClick={(e) => {
                            e.currentTarget.blur();
                            void handlePlayPause();
                        }}
                    >
                        <PlayIcon className="w-8 sm:w-10 h-auto" />
                    </button>
                    :
                    <button
                        type="button"
                        aria-label="Pause video"
                        disabled={!hasQueuedVideos}
                        className={`${PLAYBACK_BUTTON_CLASS}`}
                        onClick={(e) => {
                            e.currentTarget.blur();
                            void handlePlayPause();
                        }}
                    >
                        <PauseIcon className="w-8 sm:w-10 h-auto" />
                    </button>
                }

                <button
                    type="button"
                    aria-label="Go to next video"
                    disabled={!canGoToNext}
                    className={`${PLAYBACK_BUTTON_CLASS}`}
                    onClick={(e) => {
                        e.currentTarget.blur();
                        void handleGoToNext();
                    }}
                >
                    <SkipNextIcon className="w-8 sm:w-10 h-auto" />
                </button>
            </div>

            <div
                className="flex relative items-center"
                ref={volumeControlRef}
                onMouseEnter={() => {
                    setShowVolumePopup(true);
                }}
                onMouseLeave={() => {
                    setShowVolumePopup(false);
                }}
            >
                <button
                    type="button"
                    aria-label={watchMuted ? "Unmute volume" : "Mute volume"}
                    title={watchMuted ? "Unmute" : "Mute"}
                    className={PLAYBACK_BUTTON_CLASS}
                    onPointerDown={(event) => { // only apply to mobile so they can click to toggle
                        volumePointerIsTouchRef.current = event.pointerType !== "mouse";
                    }}
                    onClick={(e) => {
                        e.currentTarget.blur();
                        
                        const isTouchInteraction = volumePointerIsTouchRef.current;
                        volumePointerIsTouchRef.current = false; // immediately consumes the onPointerDown set (onPointerDown runs before onClick if pointer action)

                        // On touch devices, first tap opens the volume slider instead of muting immediately.
                        if (isTouchInteraction && !(showVolumePopup || volumePopupToggled)) {
                            setShowVolumePopup(true);
                            setVolumePopupToggled(true);
                            return;
                        }

                        handleToggleMuted();

                        if (isTouchInteraction) {
                            setShowVolumePopup(true);
                            setVolumePopupToggled(true);
                        }
                    }}
                >
                    <VolumeIconComponent className="w-8 sm:w-10 h-auto" />
                </button>

                <div className={`${(showVolumePopup || volumePopupToggled) ? "opacity-100" : "pointer-events-none opacity-0"} 
                    flex flex-col items-center w-12 gap-2 absolute left-1/2 bottom-full -translate-x-1/2 rounded-full ${volumePopupToggled ? "bg-[rgba(25,25,25,0.7)]" : "bg-[rgba(25,25,25,0.4)]"} px-2 py-3 shadow-lg backdrop-blur-sm
                    transition-opacity`}
                >
                    <div className={`flex h-24 w-8 items-center justify-center transition-opacity ${watchMuted ? "opacity-40" : "opacity-100"}`}>
                        <input
                            type="range"
                            min={MIN_VOLUME}
                            max={MAX_VOLUME}
                            step={VOLUME_STEP}
                            value={watchVolume}
                            onChange={handleVolumeChange}
                            className="w-24 h-2 cursor-pointer accent-white -rotate-90"
                            aria-label="Volume slider"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PlaybackControls
