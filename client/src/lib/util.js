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