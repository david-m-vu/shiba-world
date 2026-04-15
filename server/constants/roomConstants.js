export const MAX_PLAYERS_PER_ROOM = 8;
export const MAX_MESSAGES_PER_ROOM = 50;
export const OBJECT_ID_MAX_LENGTH = 64;

export const DEFAULT_OBJECT_POSITION = Object.freeze([0, 0, 0]);
export const DEFAULT_OBJECT_QUATERNION = Object.freeze([0, 0, 0, 1]);
export const DEFAULT_OBJECT_VELOCITY = Object.freeze([0, 0, 0]);

// note that if we add/change movable world objects later, update this server allowlist to match
export const DEFAULT_WORLD_LOUNGE_CHAIR_GROUP_COUNT = 2;
export const DEFAULT_WORLD_LOUNGE_CHAIR_ROW_COUNT = 2;
export const DEFAULT_WORLD_LOUNGE_CHAIR_COUNT_PER_ROW = 3;
export const DEFAULT_WORLD_PLAY_AREA_SOCCER_COUNT = 5;
export const DEFAULT_WORLD_DINING_CHAIR_COUNT = 4;

// watch together constants
export const WATCH_AUTOPLAY_LEAD_MS = 1000;
export const MAX_WATCH_QUEUE_ITEMS = 100;
export const WATCH_VIDEO_ID_MAX_LENGTH = 16;
export const WATCH_TEXT_FIELD_MAX_LENGTH = 256;
export const WATCH_URL_FIELD_MAX_LENGTH = 512;
export const WATCH_PLAYBACK_RATE_MIN = 0.25;
export const WATCH_PLAYBACK_RATE_MAX = 2;
