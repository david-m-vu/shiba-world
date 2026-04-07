import { randomUUID } from "node:crypto";

import { createClient } from "redis";

import { applyPlayerState, createChatMessage, createPlayer, createSystemChatMessage } from "../players.js";
import { roomIdGenerator } from "../../util/index.js";
import {
    touchRoom,
    sanitizeObjectId,
    getAllowedObjectIdsForWorldType,
    createObjectState,
    applyObjectState,
    sanitizeWatchText,
    createWatchTogetherState,
    cloneWatchTogetherState,
    appendRoomMessage,
    serializeRoom,
} from "../roomStateHelpers.js";
import { applyWatchCommandToRoom } from "../watchTogetherCommands.js";
