import { randomUUID } from "node:crypto";

export const PLAYER_NAME_MAX_LENGTH = 32;
export const CHAT_MESSAGE_MAX_LENGTH = 240;

const DEFAULT_POSITION = Object.freeze([0, 5, 0]);
const DEFAULT_ROTATION = Object.freeze([0, 0, 0]);

const clampString = (value, maxLength) => {
    return String(value ?? "").trim().slice(0, maxLength);
};

// expects an array of three values. If value is not an array of three values, then the resulting array = fallback
// this is to mak esure player state doesn't become undefined, NaN, or wrong-length arrays
const normalizeVector3 = (value, fallback) => {
    if (!Array.isArray(value) || value.length !== 3) {
        return [...fallback];
    }

    return value.map((entry, index) => {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : fallback[index];
    });
};

export const sanitizePlayerName = (value) => {
    return clampString(value, PLAYER_NAME_MAX_LENGTH);
};

export const sanitizeChatMessage = (value) => {
    return clampString(value, CHAT_MESSAGE_MAX_LENGTH);
};

export const createPlayer = ({ id, name, position, rotation }) => {
    const safeName = sanitizePlayerName(name);
    if (!safeName) { 
        throw new Error("Player name is required.");
    }

    return { // player object
        id,
        name: safeName,
        position: normalizeVector3(position, DEFAULT_POSITION),
        rotation: normalizeVector3(rotation, DEFAULT_ROTATION),
        activeMessage: "", // represents current active speech bubble, not their full chat history. Chat history lives at the room level in room.messages
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
};

export const applyPlayerState = (player, nextState = {}) => {
    if (nextState.position !== undefined) {
        // if the given position vector in the payload is bad, fallback to player's last position. If that doesn't exist, fallback to default position
        player.position = normalizeVector3(nextState.position, player.position ?? DEFAULT_POSITION);
    }

    if (nextState.rotation !== undefined) {
        player.rotation = normalizeVector3(nextState.rotation, player.rotation ?? DEFAULT_ROTATION);
    }

    // right now, the only reason you'd want to update this field is if you want to path/clear the player's active bubble text
    // such as clearing the speech bubble after a timeout
    if (nextState.activeMessage !== undefined) {
        player.activeMessage = sanitizeChatMessage(nextState.activeMessage);
    }

    player.updatedAt = new Date().toISOString();

    return player;
};

export const createChatMessage = ({ playerId, playerName, text }) => {
    const safeText = sanitizeChatMessage(text);
    if (!safeText) {
        throw new Error("Chat message is required.");
    }

    return {
        id: randomUUID(), // chat message id - used for stable unique key and deduping
        playerId,
        playerName,
        text: safeText,
        createdAt: new Date().toISOString(),
        type: "chat",
    };
};

export const createSystemChatMessage = (text) => {
    const safeText = sanitizeChatMessage(text);
    if (!safeText) {
        throw new Error("System message is required.");
    }

    return {
        id: randomUUID(),
        playerId: "",
        playerName: "System",
        text: safeText,
        createdAt: new Date().toISOString(),
        type: "system",
    };
};
