import { WATCH_AUTOPLAY_LEAD_MS, MAX_WATCH_QUEUE_ITEMS } from "../constants/roomConstants.js";
import {
    applyWatchMutation,
    sanitizeWatchQueueVideo,
    sanitizeQueueIndex,
    sanitizeWatchTimeSec,
    sanitizeWatchPlaybackRate,
    sanitizeWatchPlaybackStatus,
} from "./roomStateHelpers.js";

export const normalizeWatchCommandType = (value) => {
    const safeType = String(value ?? "").trim().toLowerCase();

    if (safeType === "play") return "playback:play";
    if (safeType === "pause") return "playback:pause";
    if (safeType === "seek") return "playback:seek";
    if (safeType === "rate") return "playback:rate";
    if (safeType === "queue:add" || safeType === "enqueue") return "queue:add";
    if (safeType === "queue:remove" || safeType === "queue:delete") return "queue:remove";
    if (safeType === "queue:set-index" || safeType === "queue:setindex") return "queue:set-index";
    if (safeType === "queue:clear") return "queue:clear";

    return safeType;
};

export const applyWatchCommandToRoom = (room, socketId, commandPayload = {}) => {
    const commandType = normalizeWatchCommandType(commandPayload.type);
    if (!commandType) {
        throw new Error("Watch command type is required.");
    }

    // we don't want queue:add, for example, to update playback time by setting anchorServerTsMs, since it sometimes doesn't update anchorTimeSec
    const shouldRefreshAnchorServerTs = commandType.startsWith("playback:")
        || commandType === "queue:set-index";

    return applyWatchMutation(room, socketId, (watchTogether) => {
        switch (commandType) {
            case "queue:add": {
                const rawVideo = commandPayload.video ?? commandPayload.item;
                const video = sanitizeWatchQueueVideo(rawVideo);
                if (!video) {
                    throw new Error("A valid video is required.");
                }

                if (watchTogether.queue.length >= MAX_WATCH_QUEUE_ITEMS) {
                    throw new Error(`Queue limit reached (${MAX_WATCH_QUEUE_ITEMS} videos).`);
                }

                watchTogether.queue.push(video);
                if (watchTogether.currentQueueIndex < 0) {
                    watchTogether.currentQueueIndex = 0;
                    watchTogether.playbackStatus = "playing";
                    watchTogether.anchorTimeSec = 0;
                    watchTogether.anchorServerTsMs = Date.now() + WATCH_AUTOPLAY_LEAD_MS; // 1000 is the short server lead-in for the first queued item, since it needs time to load client side
                }
                return;
            }

            case "queue:remove": {
                const indexToRemove = sanitizeQueueIndex(commandPayload.queueIndex ?? commandPayload.index, -1);
                if (indexToRemove < 0 || indexToRemove >= watchTogether.queue.length) {
                    throw new Error("Queue index is out of bounds.");
                }

                watchTogether.queue.splice(indexToRemove, 1);

                if (watchTogether.queue.length === 0) {
                    watchTogether.currentQueueIndex = -1;
                    watchTogether.playbackStatus = "paused";
                    watchTogether.anchorTimeSec = 0;
                    return;
                }

                if (watchTogether.currentQueueIndex === indexToRemove) {
                    watchTogether.currentQueueIndex = Math.min(indexToRemove, watchTogether.queue.length - 1);
                    watchTogether.playbackStatus = "paused";
                    watchTogether.anchorTimeSec = 0;
                    return;
                }

                // if the watchTogether state index is > indexToRemove, we need to shift our current queue index backwards by 1
                if (watchTogether.currentQueueIndex > indexToRemove) {
                    watchTogether.currentQueueIndex -= 1;
                }
                return;
            }

            case "queue:set-index": {
                if (watchTogether.queue.length === 0) {
                    throw new Error("Queue is empty.");
                }

                const index = sanitizeQueueIndex(commandPayload.queueIndex ?? commandPayload.index, -1);
                if (index < 0 || index >= watchTogether.queue.length) {
                    throw new Error("Queue index is out of bounds.");
                }

                watchTogether.currentQueueIndex = index;
                // allowing timeSec in payload is for flexibility, but in reality anchorTimeSec should always be set to 0 on queue index change
                watchTogether.anchorTimeSec = sanitizeWatchTimeSec(commandPayload.timeSec, 0);
                watchTogether.playbackStatus = "playing"; // always set playbackStatus to playing every time we select a new video in the queue
                return;
            }

            // we currently don't have support in the frontend for this
            case "queue:clear": {
                watchTogether.queue = [];
                watchTogether.currentQueueIndex = -1;
                watchTogether.playbackStatus = "paused";
                watchTogether.anchorTimeSec = 0;
                return;
            }

            case "playback:play": {
                if (watchTogether.queue.length === 0) {
                    throw new Error("Queue is empty.");
                }

                watchTogether.playbackStatus = "playing";

                // anchorTimeSec and playbackRate can be set as well for client simplicity, although it's probably not practical / required
                watchTogether.anchorTimeSec = sanitizeWatchTimeSec(commandPayload.timeSec, watchTogether.anchorTimeSec);
                if (commandPayload.playbackRate !== undefined) {
                    watchTogether.playbackRate = sanitizeWatchPlaybackRate(
                        commandPayload.playbackRate,
                        watchTogether.playbackRate
                    );
                }
                return;
            }

            // its important pass in timeSec here because otherwise, server keeps previous anchorTimeSec, which is often older (like when play started)
            // this implies everyone will pause at stale / different times
            case "playback:pause": {
                watchTogether.playbackStatus = "paused";
                watchTogether.anchorTimeSec = sanitizeWatchTimeSec(commandPayload.timeSec, watchTogether.anchorTimeSec);
                return;
            }

            // main function here is to change anchorTimeSec
            case "playback:seek": {
                watchTogether.anchorTimeSec = sanitizeWatchTimeSec(commandPayload.timeSec, watchTogether.anchorTimeSec);
                if (commandPayload.playbackStatus !== undefined) {
                    watchTogether.playbackStatus = sanitizeWatchPlaybackStatus(
                        commandPayload.playbackStatus,
                        watchTogether.playbackStatus
                    );
                }
                return;
            }

            case "playback:rate": {
                watchTogether.playbackRate = sanitizeWatchPlaybackRate(
                    commandPayload.playbackRate,
                    watchTogether.playbackRate
                );

                if (commandPayload.timeSec !== undefined) {
                    watchTogether.anchorTimeSec = sanitizeWatchTimeSec(commandPayload.timeSec, watchTogether.anchorTimeSec);
                }
                return;
            }

            default:
                throw new Error(`Unsupported watch command type "${commandType}".`);
        }
    }, {
        refreshAnchorServerTs: shouldRefreshAnchorServerTs,
    });
};
