import { decode } from "html-entities";

const YOUTUBE_DATA_API_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_DATA_API_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";
const YOUTUBE_MAX_RESULTS = 50;

const getBestThumbnailUrl = (thumbnails) => {
    // Prefer 16:9 variants first so cards align with aspect-video in the UI.
    return thumbnails?.medium?.url
        ?? thumbnails?.maxres?.url
        ?? thumbnails?.high?.url
        ?? thumbnails?.standard?.url
        ?? thumbnails?.default?.url
        ?? null;
};

const getYoutubeApiKey = () => String(process.env.YOUTUBE_API_KEY ?? "").trim();

const validPresets = new Set([
    "trending_videos",
    "trending_music_videos",
    "kpop_music_videos"
])

// also gets the viewCount and duration associated with each video in the search results
const getYoutubeSearch = async (response, searchParams) => {
    try {
        // get video search results given query through the search endpoint
        const youtubeResponse = await fetch(`${YOUTUBE_DATA_API_SEARCH_URL}?${searchParams.toString()}`);

        if (!youtubeResponse.ok) {
            const errorPayload = await youtubeResponse.json().catch(() => null);
            return response.status(502).json({
                ok: false,
                message: "YouTube API request failed.",
                status: youtubeResponse.status,
                error: errorPayload,
                items: [],
            });
        }

        const payload = await youtubeResponse.json();
        const searchItems = Array.isArray(payload.items) ? payload.items : [];
        const videoIds = searchItems
            .map((item) => item?.id?.videoId ?? null)
            .filter(Boolean);

        // get the view count and duration of each video through the videos endpoint
        const viewCountByVideoId = new Map();
        const durationByVideoId = new Map();

        if (videoIds.length > 0) {
            const videosParams = new URLSearchParams({
                key: searchParams.get("key"),
                part: "statistics,contentDetails",
                id: videoIds.join(","),
                maxResults: String(YOUTUBE_MAX_RESULTS),
            });

            const videosResponse = await fetch(`${YOUTUBE_DATA_API_VIDEOS_URL}?${videosParams.toString()}`);
            if (videosResponse.ok) {
                const videosPayload = await videosResponse.json();
                const videosItems = Array.isArray(videosPayload.items) ? videosPayload.items : [];

                for (const videoItem of videosItems) {
                    const videoId = String(videoItem?.id ?? "").trim();
                    if (!videoId) {
                        continue;
                    }

                    viewCountByVideoId.set(videoId, videoItem?.statistics?.viewCount ?? null);
                    durationByVideoId.set(videoId, String(videoItem?.contentDetails?.duration ?? ""));
                }
            }
        }

        // construct response body from combination of search result snippets and viewCount + duration from videos endpoint
        const items = searchItems.map((item) => {
            const videoId = String(item?.id?.videoId ?? "").trim();
            const snippet = item?.snippet ?? {};

            // NOTE: we keep duration and publishedAt formatting client side
                // this is a better default because IO formatting is presentation logic, and we avoid locking API to one display format
            return {
                videoId,
                title: decode(String(snippet?.title ?? "")),
                channelTitle: decode(String(snippet?.channelTitle ?? "")),
                publishedAt: String(snippet?.publishedAt ?? ""),
                thumbnailUrl: getBestThumbnailUrl(snippet?.thumbnails),

                viewCount: viewCountByVideoId.get(videoId) ?? null,
                duration: durationByVideoId.get(videoId) ?? "",
            };
        }).filter((item) => item.videoId);

        return response.status(200).json({ ok: true, items });
        
    } catch (error) {
        response.status(502).json({
            ok: false,
            message: "Unable to reach YouTube API.",
            error: error instanceof Error ? error.message : "Unknown error.",
            items: [],
        });
    }
}

const getYoutubeVideos = async (response, searchParams) => {
    try {
        // get video search results given query through the search endpoint
        const youtubeResponse = await fetch(`${YOUTUBE_DATA_API_VIDEOS_URL}?${searchParams.toString()}`);

        if (!youtubeResponse.ok) {
            const errorPayload = await youtubeResponse.json().catch(() => null);
            return response.status(502).json({
                ok: false,
                message: "YouTube API request failed.",
                status: youtubeResponse.status,
                error: errorPayload,
                items: [],
            });
        }

        const payload = await youtubeResponse.json();
        const videosItems = Array.isArray(payload.items) ? payload.items : [];
        
        // construct response body from combination of search result snippets and viewCount + duration from videos endpoint
        const items = videosItems.map((item) => {
            const videoId = String(item?.id ?? "").trim();
            const snippet = item?.snippet ?? {};

            // NOTE: we keep duration and publishedAt formatting client side
                // this is a better default because IO formatting is presentation logic, and we avoid locking API to one display format
            return {
                videoId,
                title: decode(String(snippet?.title ?? "")),
                channelTitle: decode(String(snippet?.channelTitle ?? "")),
                publishedAt: String(snippet?.publishedAt ?? ""),
                thumbnailUrl: getBestThumbnailUrl(snippet?.thumbnails),

                viewCount: item?.statistics?.viewCount ?? null,
                duration: item?.contentDetails?.duration ?? "",
            };
        }).filter((item) => item.videoId);

        return response.status(200).json({ ok: true, items });
        
    } catch (error) {
        response.status(502).json({
            ok: false,
            message: "Unable to reach YouTube API.",
            error: error instanceof Error ? error.message : "Unknown error.",
            items: [],
        });
    }
}

// assumes api key in env is valid
const getTrendingVideos = async (response, youtubeApiKey) => {
    const searchParams = new URLSearchParams({
        key: youtubeApiKey,
        part: "snippet,contentDetails,statistics",
        maxResults: String(YOUTUBE_MAX_RESULTS),
        chart: "mostPopular",
        // regionCode: "US",
    })

    return await getYoutubeVideos(response, searchParams);
}

// assumes api key in env is valid
const getKpopMusicVideos = async (response, youtubeApiKey) => {
    const searchParams = new URLSearchParams({
        key: youtubeApiKey,
        part: "snippet",
        maxResults: String(YOUTUBE_MAX_RESULTS),
        q: "kpop mv",
        type: "video",
        order: "relevance",
        videoCategoryId: 10
    })

    return await getYoutubeSearch(response, searchParams)
}

// assumes api key in env is valid
const getTrendingMusicVideos = async (response, youtubeApiKey) => {
    const searchParams = new URLSearchParams({
        key: youtubeApiKey,
        part: "snippet,contentDetails,statistics",
        maxResults: String(YOUTUBE_MAX_RESULTS),
        chart: "mostPopular",
        // regionCode: "US",
        videoCategoryId: "10"
    })

    return await getYoutubeVideos(response, searchParams);
}

export const getPreset = async (request, response) => {
    console.log(request.query)
    
    const kind = String(request.query.kind ?? "").trim();
    if (!kind) {
        return response.status(400).json({
            ok: false,
            message: "Query parameter 'kind' is required.",
            items: [],
        });
    }

    if (!validPresets.has(kind)) {
        return response.status(400).json({
            ok: false,
            message: "Preset specified by 'kind' query parameter is invalid.",
            items: [],
        });
    }

    const youtubeApiKey = getYoutubeApiKey();
    if (!youtubeApiKey) {
        return response.status(500).json({
            ok: false,
            message: "YOUTUBE_API_KEY is not configured on the server.",
            items: [],
        })
    }

    if (kind === "trending_videos") {
        return await getTrendingVideos(response, youtubeApiKey);
    } else if (kind === "trending_music_videos") {
        return await getTrendingMusicVideos(response, youtubeApiKey);
    } else if (kind === "kpop_music_videos") {
        return await getKpopMusicVideos(response, youtubeApiKey);
    }
}

// we treat 0 result searches as successful
export const searchList = async (request, response) => {
    // input validation
    const query = String(request.query.q ?? "").trim();
    if (!query) {
        return response.status(400).json({
            ok: false,
            message: "Query parameter 'q' is required.",
            items: [],
        });
    }

    // env validation
    const youtubeApiKey = getYoutubeApiKey();
    if (!youtubeApiKey) {
        return response.status(500).json({
            ok: false,
            message: "YOUTUBE_API_KEY is not configured on the server.",
            items: [],
        });
    }

    const searchParams = new URLSearchParams({
        key: youtubeApiKey,
        part: "snippet",
        type: "video",
        q: query,
        maxResults: String(YOUTUBE_MAX_RESULTS),
    });

    return await getYoutubeSearch(response, searchParams);
}

export const getVideoById = async (request, response) => {
    const videoId = String(request.query.videoId ?? "").trim();
    if (!videoId) {
        return response.status(400).json({
            ok: false,
            message: "Query parameter 'videoId' is required.",
            item: null,
        });
    }

    const youtubeApiKey = getYoutubeApiKey();
    if (!youtubeApiKey) {
        return response.status(500).json({
            ok: false,
            message: "YOUTUBE_API_KEY is not configured on the server.",
            item: null,
        });
    }

    const videoParams = new URLSearchParams({
        key: youtubeApiKey,
        part: "snippet,statistics,contentDetails",
        id: videoId,
        maxResults: "1",
    });

    try {
        const youtubeResponse = await fetch(`${YOUTUBE_DATA_API_VIDEOS_URL}?${videoParams.toString()}`);
        if (!youtubeResponse.ok) {
            const errorPayload = await youtubeResponse.json().catch(() => null);
            return response.status(502).json({
                ok: false,
                message: "YouTube API request failed.",
                status: youtubeResponse.status,
                error: errorPayload,
                item: null,
            });
        }

        const payload = await youtubeResponse.json();
        const firstVideo = Array.isArray(payload.items) ? payload.items[0] : null;
        if (!firstVideo) {
            return response.status(404).json({
                ok: false,
                message: "No YouTube video found for that videoId.",
                item: null,
            });
        }

        const snippet = firstVideo?.snippet ?? {};
        const item = {
            videoId: String(firstVideo?.id ?? "").trim(),
            title: decode(String(snippet?.title ?? "")),
            channelTitle: decode(String(snippet?.channelTitle ?? "")),
            publishedAt: String(snippet?.publishedAt ?? ""),
            thumbnailUrl: getBestThumbnailUrl(snippet?.thumbnails),

            viewCount: firstVideo?.statistics?.viewCount ?? null,
            duration: String(firstVideo?.contentDetails?.duration ?? ""),
        };

        if (!item.videoId) {
            return response.status(404).json({
                ok: false,
                message: "No YouTube video found for that videoId.",
                item: null,
            });
        }

        return response.status(200).json({
            ok: true,
            item,
        });

    } catch (error) {
        return response.status(502).json({
            ok: false,
            message: "Unable to reach YouTube API.",
            error: error instanceof Error ? error.message : "Unknown error.",
            item: null,
        });
    }
};
