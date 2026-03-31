const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_PATH_VIDEO_SEGMENTS = new Set(["embed", "shorts", "live", "v"]);

export const formatViews = (viewCount) => {
    const numericViews = Number(viewCount);
    if (!Number.isFinite(numericViews) || numericViews < 0) {
        return "No views";
    }

    // use US number style, abbreviate large numbers, and keep at most one decimal
    const formatted = new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(numericViews);

    return `${formatted} views`;
};

export const formatPublishedAgo = (publishedAt) => {
    const publishedAtMs = new Date(publishedAt).getTime(); // returns ms
    if (!Number.isFinite(publishedAtMs)) {
        return "Unknown date";
    }

    // get seconds since video was published
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - publishedAtMs) / 1000));
    if (elapsedSeconds < 60) {
        return "just now";
    }

    const units = [
        { label: "year", seconds: 31536000 },
        { label: "month", seconds: 2592000 },
        { label: "week", seconds: 604800 },
        { label: "day", seconds: 86400 },
        { label: "hour", seconds: 3600 },
        { label: "minute", seconds: 60 },
    ];

    for (const unit of units) {
        const unitValue = Math.floor(elapsedSeconds / unit.seconds);

        // unitValue is >= 1 if this is the best unit to represent the time since the video was published.
        // It is a fraction < 1 if the unit is too large to represent elapsedSeconds
        if (unitValue >= 1) {
            const suffix = unitValue === 1 ? "" : "s"; // decide whether or not to include the s (ex: year vs years)
            return `${unitValue} ${unit.label}${suffix} ago`;
        }
    }

    return "just now";
};

export const formatVideoDuration = (duration) => {
    // breaks down a string like PT1H30M15S into its individual components
    const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(duration ?? "").trim());
    if (!match) {
        return "";
    }

    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Number(match[3] ?? 0);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) {
        return "";
    }

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/*
 * Common valid forms put the ID at:
 * query param v=...
 * first segment on youtu.be/...
 * second segment on /embed/..., /shorts/..., /live/..., /v/...
 */
export const extractYoutubeVideoId = (inputValue) => {
    const normalizedInput = String(inputValue ?? "").trim();
    if (!normalizedInput) {
        return "";
    }

    // Support direct video id input as a convenience.
    if (YOUTUBE_VIDEO_ID_REGEX.test(normalizedInput)) {
        return normalizedInput;
    }

    const urlCandidate = /^https?:\/\//i.test(normalizedInput)
        ? normalizedInput
        : `https://${normalizedInput}`;

    let parsedUrl;
    try {
        parsedUrl = new URL(urlCandidate);
    } catch {
        return "";
    }

    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

    // Ex: https://youtu.be/ArmDp-zijuc, https://www.youtube.com/shorts/ArmDp-zijuc, https://www.youtube.com/embed/ArmDp-zijuc
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);

    // youtu.be is Youtube's official short-link domain, which usually stores the video ID in the path
    if (hostname === "youtu.be") {
        const shortenedUrlVideoId = String(pathSegments[0] ?? "").trim();
        return YOUTUBE_VIDEO_ID_REGEX.test(shortenedUrlVideoId) ? shortenedUrlVideoId : "";
    }

    const isYoutubeHost = hostname === "youtube.com"
        || hostname.endsWith(".youtube.com")
        || hostname === "youtube-nocookie.com"
        || hostname.endsWith(".youtube-nocookie.com");

    if (!isYoutubeHost) {
        return "";
    }

    // check if video id exists in the v query param
    const watchQueryVideoId = String(parsedUrl.searchParams.get("v") ?? "").trim();
    if (YOUTUBE_VIDEO_ID_REGEX.test(watchQueryVideoId)) {
        return watchQueryVideoId;
    }

    const maybeSegmentType = pathSegments[0];
    const segmentVideoId = String(pathSegments[1] ?? "").trim();
    if (!YOUTUBE_PATH_VIDEO_SEGMENTS.has(maybeSegmentType)) {
        return "";
    }

    return YOUTUBE_VIDEO_ID_REGEX.test(segmentVideoId) ? segmentVideoId : "";
};
