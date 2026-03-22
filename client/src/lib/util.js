export const toSafeVector3 = (value, fallback = [0, 0, 0]) => {
    if (!Array.isArray(value) || value.length !== 3) {
        return [...fallback];
    }

    return value.map((entry, index) => {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : fallback[index];
    })
}

export const toSafeVector4 = (value, fallback = [0, 0, 0, 1]) => {
    if (!Array.isArray(value) || value.length !== 4) {
        return [...fallback];
    }

    const normalized = value.map((entry, index) => {
        const parsed = Number(entry);
        return Number.isFinite(parsed) ? parsed : fallback[index];
    });
    const length = Math.hypot(normalized[0], normalized[1], normalized[2], normalized[3]);

    if (length < 0.000001) {
        return [...fallback];
    }

    return normalized.map((entry) => entry / length);
}

export const getShortestAngleDelta = (a, b) => {
    const TWO_PI = Math.PI * 2;
    return (((b - a + Math.PI) % TWO_PI + TWO_PI) % TWO_PI) - Math.PI;
};

export const anchorOffset = (size, anchor) => {
    if (!anchor || anchor === "center") {
        return [0, 0, 0];
    }
    const [sx, sy, sz] = size;
    switch (anchor) {
        case "maxXmaxZ": // position is at the +X,+Z corner
            return [-sx / 2, 0, -sz / 2];
        case "minXmaxZ": // position is at the -X,+Z corner
            return [sx / 2, 0, -sz / 2];
        case "maxXminZ": // position is at the +X,-Z corner
            return [-sx / 2, 0, sz / 2];
        case "minXminZ": // position is at the -X,-Z corner
            return [sx / 2, 0, sz / 2];
        default:
            return [0, 0, 0];
    }
};

// pseudo rng counter-based to produce a predictable sequence of numbers based on an inital seed (generates [0, 1))
export const createDeterministicRandom = (seed) => {
    // unsigned right shift to force value into a 32 bit unsigned integer
    let state = seed >>> 0;
    // return a closure that remembers this state variable
    return () => {
        state += 0x6D2B79F5; // move state forward by a large constant to ensure generator doesn't repeat itself
        let t = state;
        // scramble bits
        t = Math.imul(t ^ (t >>> 15), t | 1);  // mix top half with bottom half, then multiply by an odd number so that no informatio nis "lost" due to zeros shifting in
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // 4294967296 is 2^32. convert 32 integer into a decimal between 0 and 1
    };
};

// generates a random number between min and max
export const randomRange = (rng, min, max) => min + (max - min) * rng();