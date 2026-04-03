export const normalizeVector3 = (value, fallback = DEFAULT_OBJECT_POSITION) => {
    if (!Array.isArray(value) || value.length !== 3) {
        return [...fallback];
    }

    return value.map((entry, index) => {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : fallback[index];
    });
};

export const normalizeQuaternion = (value, fallback = DEFAULT_OBJECT_QUATERNION) => {
    if (!Array.isArray(value) || value.length !== 4) {
        return [...fallback];
    }

    const normalized = value.map((entry, index) => {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : fallback[index];
    });
    const length = Math.hypot(normalized[0], normalized[1], normalized[2], normalized[3]);

    // a zero quaternion is invalid for rotation, and this is to avoid dividing by zero
    if (length < 0.000001) {
        return [...fallback];
    }

    return normalized.map((entry) => entry / length);
};

export const toFiniteNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const clampNumber = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
};