export const DEFAULT_AVATAR_MODEL = "shiba";

const ALLOWED_AVATAR_MODEL_SET = new Set([
    "astro_shiba",
    "black_shiba",
    "bodyguard_shiba",
    "constellation_shiba",
    "shiba",
]);

export const sanitizeAvatarModel = (value) => {
    const safeValue = String(value ?? "").trim().toLowerCase();
    if (ALLOWED_AVATAR_MODEL_SET.has(safeValue)) {
        return safeValue;
    }

    return DEFAULT_AVATAR_MODEL;
};
