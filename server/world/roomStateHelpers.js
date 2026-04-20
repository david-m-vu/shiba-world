import {
    MAX_MESSAGES_PER_ROOM,
    OBJECT_ID_MAX_LENGTH,
    DEFAULT_OBJECT_POSITION,
    DEFAULT_OBJECT_QUATERNION,
    DEFAULT_OBJECT_VELOCITY,
    DEFAULT_WORLD_LOUNGE_CHAIR_GROUP_COUNT,
    DEFAULT_WORLD_LOUNGE_CHAIR_ROW_COUNT,
    DEFAULT_WORLD_LOUNGE_CHAIR_COUNT_PER_ROW,
    DEFAULT_WORLD_PLAY_AREA_SOCCER_COUNT,
    DEFAULT_WORLD_DINING_CHAIR_COUNT,
    WATCH_VIDEO_ID_MAX_LENGTH,
    WATCH_TEXT_FIELD_MAX_LENGTH,
    WATCH_URL_FIELD_MAX_LENGTH,
    WATCH_PLAYBACK_RATE_MIN,
    WATCH_PLAYBACK_RATE_MAX,
    WATCH_AUTOPLAY_LEAD_MS, 
    MAX_WATCH_QUEUE_ITEMS,
    MAX_PLAYERS_PER_ROOM
} from "../constants/roomConstants.js";
import { normalizeVector3, normalizeQuaternion, toFiniteNumber, clampNumber } from "../util/index.js";

const buildDefaultWorldAllowedObjectIds = () => {
    const allowedObjectIds = new Set([
        "cabana-coffee-table-0",
        "cabana-lounge-chair-0",
        "cabana-lounge-chair-1",
        "cabana-lounge-chair-2",
        "lounge-coffee-table-0",
        "lounge-coffee-table-1",
    ]);

    for (let index = 0; index < DEFAULT_WORLD_PLAY_AREA_SOCCER_COUNT; index++) {
        allowedObjectIds.add(`play-area-soccer-${index}`);
    }

    for (let index = 0; index < DEFAULT_WORLD_DINING_CHAIR_COUNT; index++) {
        allowedObjectIds.add(`lounge-dining-set-chair-${index}`);
    }

    for (let groupIndex = 0; groupIndex < DEFAULT_WORLD_LOUNGE_CHAIR_GROUP_COUNT; groupIndex++) {
        for (let rowIndex = 0; rowIndex < DEFAULT_WORLD_LOUNGE_CHAIR_ROW_COUNT; rowIndex++) {
            for (let chairIndex = 0; chairIndex < DEFAULT_WORLD_LOUNGE_CHAIR_COUNT_PER_ROW; chairIndex += 1) {
                allowedObjectIds.add(`lounge-chair-section-${groupIndex}-${rowIndex}-${chairIndex}`);
            }
        }
    }

    return allowedObjectIds;
};

const ALLOWED_OBJECT_IDS_BY_WORLD_TYPE = {
    default: buildDefaultWorldAllowedObjectIds(),
    rooftop: buildDefaultWorldAllowedObjectIds(),
};

// mark the room as recently changed, called after player join, leave, player state updates, chat message added...
// useful if we plan to expire empty / inactive rooms
export const touchRoom = (room) => {
    room.updatedAt = new Date().toISOString();
    return room;
};

export const getAllowedObjectIdsForWorldType = (worldType) => {
    const safeWorldType = String(worldType ?? "").trim();
    return ALLOWED_OBJECT_IDS_BY_WORLD_TYPE[safeWorldType] ?? null;
};

export const sanitizeObjectId = (value) => {
    // this is to prevent clients from sending huge objectId strings that coudl waste memory in room.objects keys
    return String(value ?? "").trim().slice(0, OBJECT_ID_MAX_LENGTH);
};

export const createObjectState = ({ id, position, quaternion, linvel, angvel }) => {
    return {
        id,
        position: normalizeVector3(position, DEFAULT_OBJECT_POSITION),
        quaternion: normalizeQuaternion(quaternion, DEFAULT_OBJECT_QUATERNION),
        linvel: normalizeVector3(linvel, DEFAULT_OBJECT_VELOCITY), // default to 0 linear velocity in units/s
        angvel: normalizeVector3(angvel, DEFAULT_OBJECT_VELOCITY), // default to 0 angular velocity around each axis in radians/second
        updatedAt: new Date().toISOString(),
    };
};

export const applyObjectState = (objectState, nextObjectState = {}) => {
    if (nextObjectState.position !== undefined) {
        objectState.position = normalizeVector3(nextObjectState.position, objectState.position ?? DEFAULT_OBJECT_POSITION);
    }

    if (nextObjectState.quaternion !== undefined) {
        objectState.quaternion = normalizeQuaternion(nextObjectState.quaternion, objectState.quaternion ?? DEFAULT_OBJECT_QUATERNION);
    }

    if (nextObjectState.linvel !== undefined) {
        objectState.linvel = normalizeVector3(nextObjectState.linvel, objectState.linvel ?? DEFAULT_OBJECT_VELOCITY);
    }

    if (nextObjectState.angvel !== undefined) {
        objectState.angvel = normalizeVector3(nextObjectState.angvel, objectState.angvel ?? DEFAULT_OBJECT_VELOCITY);
    }

    objectState.updatedAt = new Date().toISOString();
    return objectState;
};

export const sanitizeWatchText = (value, maxLength = WATCH_TEXT_FIELD_MAX_LENGTH) => {
    return String(value ?? "").trim().slice(0, maxLength);
};

export const sanitizeWatchPlaybackStatus = (value, fallback = "paused") => {
    const safeStatus = String(value ?? "").trim().toLowerCase();
    if (safeStatus === "playing" || safeStatus === "paused") {
        return safeStatus;
    }

    return fallback;
};

export const sanitizeWatchTimeSec = (value, fallback = 0) => {
    const nextTimeSec = toFiniteNumber(value, fallback);
    return Math.max(0, nextTimeSec);
};

export const sanitizeWatchPlaybackRate = (value, fallback = 1) => {
    const nextRate = toFiniteNumber(value, fallback);
    return clampNumber(nextRate, WATCH_PLAYBACK_RATE_MIN, WATCH_PLAYBACK_RATE_MAX);
};

// -1 queue index indicates there is nothing in the queue
export const sanitizeQueueIndex = (value, fallback = -1) => {
    const nextIndex = Number(value);
    if (!Number.isInteger(nextIndex)) {
        return fallback;
    }

    return nextIndex;
};

export const sanitizeWatchQueueVideo = (video = {}) => {
    const videoId = sanitizeWatchText(video.videoId, WATCH_VIDEO_ID_MAX_LENGTH);
    if (!videoId) {
        return null;
    }

    return {
        videoId,
        title: sanitizeWatchText(video.title, WATCH_TEXT_FIELD_MAX_LENGTH),
        channelTitle: sanitizeWatchText(video.channelTitle, WATCH_TEXT_FIELD_MAX_LENGTH),
        publishedAt: sanitizeWatchText(video.publishedAt, 64),
        thumbnailUrl: sanitizeWatchText(video.thumbnailUrl, WATCH_URL_FIELD_MAX_LENGTH),
        viewCount: sanitizeWatchText(video.viewCount, 64),
        duration: sanitizeWatchText(video.duration, 64),
    };
};

export const cloneWatchQueue = (queue = []) => {
    if (!Array.isArray(queue)) {
        return [];
    }

    return queue
        .map((video) => sanitizeWatchQueueVideo(video))
        .filter(Boolean);
};

/*
 * Typical client calc:
 * If playing: effectiveTime = anchorTimeSec + ((nowMs - anchorServerTsMs) / 1000) * playbackRate
 * If paused: effectiveTime = anchorTimeSec
 */
export const createWatchTogetherState = () => {
    const nowMs = Date.now();
    return {
        queue: [], // queue containing watchQueueVideos
        currentQueueIndex: -1,
        playbackStatus: "paused",
        playbackRate: 1,
        anchorTimeSec: 0, // authoritative video time in s at a known moment (ex: if someone seeks to 53.2, server sets anchorTimeSec = 53.2)
        anchorServerTsMs: nowMs, // server's timestamp in ms for when the anchor was recorded. Clients use this with anchorTimeSec
        version: 0, // monotonic state revision number - lets clients ignore stale/out-of-order watch:stack packets (higher versionw ins)
        updatedBy: null,
        updatedAt: new Date(nowMs).toISOString(),
    };
};

export const cloneWatchTogetherState = (watchTogether) => {
    const fallbackState = createWatchTogetherState();
    const queue = cloneWatchQueue(watchTogether?.queue ?? fallbackState.queue);
    const currentQueueIndex = sanitizeQueueIndex(watchTogether?.currentQueueIndex, -1);
    const safeQueueIndex = queue.length === 0
        ? -1
        : clampNumber(currentQueueIndex, 0, queue.length - 1);

    return {
        queue,
        currentQueueIndex: safeQueueIndex,
        playbackStatus: sanitizeWatchPlaybackStatus(watchTogether?.playbackStatus, fallbackState.playbackStatus),
        playbackRate: sanitizeWatchPlaybackRate(watchTogether?.playbackRate, fallbackState.playbackRate),
        anchorTimeSec: sanitizeWatchTimeSec(watchTogether?.anchorTimeSec, fallbackState.anchorTimeSec),
        anchorServerTsMs: toFiniteNumber(watchTogether?.anchorServerTsMs, fallbackState.anchorServerTsMs),
        serverNowMs: Date.now(), // server timestamp when this watch state was serialized
        version: Math.max(0, toFiniteNumber(watchTogether?.version, fallbackState.version)),
        updatedBy: watchTogether?.updatedBy ? String(watchTogether.updatedBy) : null,
        updatedAt: sanitizeWatchText(watchTogether?.updatedAt, 64) || fallbackState.updatedAt,
    };
};

// clone before getting watch together state because it avoids shared-reference bugs by ensuring mutations happen on a fresh safe object
// also keeps outbound state isolated from internal mutable references
export const getWatchTogetherState = (room) => {
    if (!room.watchTogether) {
        room.watchTogether = createWatchTogetherState();
    }

    // if we want to future proof object mutation bugs
    // else {
    //     room.watchTogether = cloneWatchTogetherState(room.watchTogether);
    // }

    return room.watchTogether;
};

// applies mutation function on room watchTogether state then sanitizes and updates metadata
// also adds a version attribute which is used client side to ensure the most up to date state
export const applyWatchMutation = (room, socketId, mutate, { refreshAnchorServerTs = true } = {}) => {
    const watchTogether = getWatchTogetherState(room);
    mutate(watchTogether);

    const nowMs = Date.now();
    watchTogether.version = Math.max(0, toFiniteNumber(watchTogether.version, 0)) + 1; // default to 0 if initially null / undefined
    watchTogether.updatedBy = socketId;
    if (refreshAnchorServerTs) {
        watchTogether.anchorServerTsMs = nowMs;
    }
    watchTogether.updatedAt = new Date(nowMs).toISOString();

    // keep queue/index coherent after every command
    if (watchTogether.queue.length === 0) {
        watchTogether.currentQueueIndex = -1;
        watchTogether.playbackStatus = "paused";
        watchTogether.anchorTimeSec = 0;
    } else {
        watchTogether.currentQueueIndex = clampNumber(
            sanitizeQueueIndex(watchTogether.currentQueueIndex, 0),
            0,
            watchTogether.queue.length - 1
        );
        watchTogether.playbackStatus = sanitizeWatchPlaybackStatus(watchTogether.playbackStatus, "paused");
        watchTogether.playbackRate = sanitizeWatchPlaybackRate(watchTogether.playbackRate, 1);
        watchTogether.anchorTimeSec = sanitizeWatchTimeSec(watchTogether.anchorTimeSec, 0);
    }

    touchRoom(room);
    return cloneWatchTogetherState(watchTogether);
};

export const appendRoomMessage = (room, messageObj) => {
    room.messages.push(messageObj);

    // only maintain the last 50 messages in the room
    if (room.messages.length > MAX_MESSAGES_PER_ROOM) {
        room.messages.shift();
    }

    touchRoom(room);
    return messageObj;
};

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


// make the room object able to be converted to a valid JSON
export const serializeRoom = (room) => {
    return {
        id: room.id,
        worldType: room.worldType,
        hostSocketId: room.hostSocketId,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        players: Array.from(room.players.values()), // room.players is a map of player ids to player objects. Taking just the values from the map is OK since we can reconvert to map easily with player.id
        objects: Array.from(room.objects.values()), // room.objects is a map of physical object ids to physical object objects. Taking just the values from the map is OK since we can reconvert to map easily with object.id
        messages: [...room.messages], // copy with spread operator - messages is an array of message objects. Earlier elements are the oldest messages
        watchTogether: cloneWatchTogetherState(room.watchTogether),
        maxPlayers: room.maxPlayers ?? MAX_PLAYERS_PER_ROOM
    };
};
