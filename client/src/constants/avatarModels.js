export const DEFAULT_AVATAR_MODEL = "shiba";

export const AVATAR_MODELS = Object.freeze([
    "astro_shiba",
    "black_shiba",
    "bodyguard_shiba",
    "constellation_shiba",
    "shiba",
]);

const AVATAR_MODEL_SET = new Set(AVATAR_MODELS);

export const AVATAR_MODEL_URLS = Object.freeze({
    astro_shiba: "/models/astro_shiba/scene.gltf",
    black_shiba: "/models/black_shiba/scene.glb",
    bodyguard_shiba: "/models/bodyguard_shiba/scene.glb",
    constellation_shiba: "/models/constellation_shiba/scene.glb",
    shiba: "/models/shiba/scene.glb",
});

export const normalizeAvatarModel = (value) => {
    const safeValue = String(value ?? "").trim().toLowerCase();
    if (AVATAR_MODEL_SET.has(safeValue)) {
        return safeValue;
    }

    return DEFAULT_AVATAR_MODEL;
};

export const toAvatarModelUrl = (value) => {
    const safeModel = normalizeAvatarModel(value);
    return AVATAR_MODEL_URLS[safeModel] ?? AVATAR_MODEL_URLS[DEFAULT_AVATAR_MODEL];
};
