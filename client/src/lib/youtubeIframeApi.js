const YOUTUBE_IFRAME_API_URL = "https://www.youtube.com/iframe_api";
const YOUTUBE_IFRAME_PROMISE_KEY = "__shibaWorldYoutubeIframeApiPromise"; // used to store the promise that loads the youtube iframe api

export const getYoutubeIframeApi = () => {
    if (typeof window === "undefined") {
        return Promise.reject(new Error("Window is unavailable."));
    }

    // if the youtube API has already been loaded
    if (window.YT?.Player) {
        return Promise.resolve(window.YT);
    }

    // if promise has already been created
    if (window[YOUTUBE_IFRAME_PROMISE_KEY]) {
        return window[YOUTUBE_IFRAME_PROMISE_KEY];
    }

    window[YOUTUBE_IFRAME_PROMISE_KEY] = new Promise((resolve, reject) => {
        const previousOnReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            if (typeof previousOnReady === "function") {
                previousOnReady();
            }
            // signal that the API loaded. we .then this promise, then initialize YT.Player once everything is in place
            resolve(window.YT);
        };

        const existingScript = document.querySelector(`script[src="${YOUTUBE_IFRAME_API_URL}"]`);
        if (existingScript) {
            return;
        }

        const script = document.createElement("script");
        script.src = YOUTUBE_IFRAME_API_URL;
        script.async = true;
        script.onerror = () => {
            reject(new Error("Failed to load YouTube IFrame API."));
        };

        document.head.appendChild(script);
    });

    return window[YOUTUBE_IFRAME_PROMISE_KEY];
};