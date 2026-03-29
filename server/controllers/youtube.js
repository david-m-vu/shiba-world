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
    const youtubeApiKey = String(process.env.YOUTUBE_API_KEY ?? "").trim();
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
                key: youtubeApiKey,
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
