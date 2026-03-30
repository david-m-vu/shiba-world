import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "../store/useGameStore.js";

import SearchIcon from "../assets/icons/search.svg?react";
import DeleteIcon from "../assets/icons/delete.svg?react";
import CloseIcon from "../assets/icons/close.svg?react";
import ShibaInuFace from "../assets/icons/shiba-inu.png";

const SERVER_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const YOUTUBE_IFRAME_API_URL = "https://www.youtube.com/iframe_api";
const YOUTUBE_IFRAME_PROMISE_KEY = "__shibaWorldYoutubeIframeApiPromise"; // used to store the promise that loads the youtube iframe api

const getYoutubeIframeApi = () => {
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

const tempSearchResults = {
    "ok": true,
    "items": [
        {
            "videoId": "ArmDp-zijuc",
            "title": "NewJeans (뉴진스) 'Super Shy' Official MV",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2023-07-07T03:58:10Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/ArmDp-zijuc/mqdefault.jpg",
            "viewCount": "277709190",
            "duration": "PT3M21S"
        },
        {
            "videoId": "sVTy_wmn5SU",
            "title": "NewJeans (뉴진스) 'OMG' Official MV (Performance ver.1)",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2023-01-03T11:30:01Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/sVTy_wmn5SU/mqdefault.jpg",
            "viewCount": "387472533",
            "duration": "PT3M40S"
        },
        {
            "videoId": "ZncbtRo7RXs",
            "title": "NewJeans (뉴진스) ‘Supernatural’ Official MV (Part.1)",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2024-06-21T04:00:01Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/ZncbtRo7RXs/mqdefault.jpg",
            "viewCount": "85846987",
            "duration": "PT3M11S"
        },
        {
            "videoId": "G8GEpK7YDl4",
            "title": "NewJeans 'New Jeans (ft. The Powerpuff Girls)' Lyrics (뉴진스 New Jeans 가사) (Color Coded Lyrics)",
            "channelTitle": "Jaeguchi",
            "publishedAt": "2023-07-07T04:41:58Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/G8GEpK7YDl4/mqdefault.jpg",
            "viewCount": "16548307",
            "duration": "PT1M50S"
        },
        {
            "videoId": "xeiqi7uTwDU",
            "title": "This NewJeans Update Made Things Worse…",
            "channelTitle": "dramatized",
            "publishedAt": "2026-03-25T17:58:00Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/xeiqi7uTwDU/mqdefault.jpg",
            "viewCount": "2715",
            "duration": "PT4M11S"
        },
        {
            "videoId": "jOTfBlKSQYY",
            "title": "NewJeans (뉴진스) 'ETA' Official MV",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2023-07-21T03:58:10Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/jOTfBlKSQYY/mqdefault.jpg",
            "viewCount": "112610798",
            "duration": "PT3M37S"
        },
        {
            "videoId": "Km71Rr9K-Bw",
            "title": "NewJeans (뉴진스) 'Ditto' Performance Video",
            "channelTitle": "NewJeans",
            "publishedAt": "2022-12-30T10:00:01Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/Km71Rr9K-Bw/mqdefault.jpg",
            "viewCount": "208346102",
            "duration": "PT3M10S"
        },
        {
            "videoId": "VOmIplFAGeg",
            "title": "NewJeans (뉴진스) 'Cookie' Official MV",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2022-08-01T08:58:12Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/VOmIplFAGeg/mqdefault.jpg",
            "viewCount": "133707507",
            "duration": "PT3M59S"
        },
        {
            "videoId": "Q3K0TOvTOno",
            "title": "NewJeans (뉴진스) 'How Sweet' Official MV",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2024-05-24T07:00:00Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/Q3K0TOvTOno/mqdefault.jpg",
            "viewCount": "73619626",
            "duration": "PT4M3S"
        },
        {
            "videoId": "3rfwR0BBwyk",
            "title": "THATS A LOT OF HAIR SPRAY... 💀 #newjeans #njz #kpop",
            "channelTitle": "WIZBIT",
            "publishedAt": "2025-10-02T11:50:27Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/3rfwR0BBwyk/mqdefault.jpg",
            "viewCount": "39272184",
            "duration": "PT12S"
        },
        {
            "videoId": "11cta61wi0g",
            "title": "NewJeans (뉴진스) 'Hype Boy' Official MV (Performance ver.1)",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2022-08-18T09:00:01Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/11cta61wi0g/mqdefault.jpg",
            "viewCount": "241236817",
            "duration": "PT2M58S"
        },
        {
            "videoId": "mssHvY7O6Fo",
            "title": "NewJeans (뉴진스) | 'New Jeans' | Color Coded Lyrics |【Rom/Eng/Esp】",
            "channelTitle": "Snowy토끼",
            "publishedAt": "2023-08-01T04:44:45Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/mssHvY7O6Fo/mqdefault.jpg",
            "viewCount": "3292847",
            "duration": "PT1M49S"
        },
        {
            "videoId": "enz-d4cQq_c",
            "title": "Dxrkaii, Jiandro - New Jeans (Jersey Club - Slowed Down)",
            "channelTitle": "TheGoodVibe",
            "publishedAt": "2025-03-08T16:12:41Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/enz-d4cQq_c/mqdefault.jpg",
            "viewCount": "15443356",
            "duration": "PT1M50S"
        },
        {
            "videoId": "Rrf8uQFvICE",
            "title": "NewJeans (뉴진스) 'Hype Boy' Official MV (MINJI ver.)",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2022-07-23T05:28:15Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/Rrf8uQFvICE/mqdefault.jpg",
            "viewCount": "30574815",
            "duration": "PT2M57S"
        },
        {
            "videoId": "K3A26madxok",
            "title": "Mommy Really Cares About us🌎 | New Jeans Jersey Remix (Miside Mita EditTikTok Version)",
            "channelTitle": "SAMIR AVENGER GM",
            "publishedAt": "2025-01-05T18:38:00Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/K3A26madxok/mqdefault.jpg",
            "viewCount": "6818691",
            "duration": "PT41S"
        },
        {
            "videoId": "kcelgrGY1h8",
            "title": "NewJeans (뉴진스) 'New Jeans' Official MV",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2023-07-06T15:00:01Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/kcelgrGY1h8/mqdefault.jpg",
            "viewCount": "41351891",
            "duration": "PT3M31S"
        },
        {
            "videoId": "ogklOvuqJH0",
            "title": "Hype Boy - NewJeans ニュージーンズ  [Music Bank] | KBS WORLD TV 220819",
            "channelTitle": "KBS WORLD TV",
            "publishedAt": "2022-08-19T09:28:33Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/ogklOvuqJH0/mqdefault.jpg",
            "viewCount": "5391427",
            "duration": "PT3M11S"
        },
        {
            "videoId": "x8RIixqumUc",
            "title": "NewJeans (뉴진스) 'Attention' Official MV (Performance ver.)",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2022-07-22T03:00:02Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/x8RIixqumUc/mqdefault.jpg",
            "viewCount": "86729696",
            "duration": "PT2M58S"
        },
        {
            "videoId": "js1CtxSY38I",
            "title": "NewJeans (뉴진스) 'Attention' Official MV",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2022-07-21T15:00:14Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/js1CtxSY38I/mqdefault.jpg",
            "viewCount": "80528102",
            "duration": "PT4M23S"
        },
        {
            "videoId": "dJdqn5v4Dkw",
            "title": "NewJeans (뉴진스) 'ASAP' Official MV",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2023-07-25T15:00:02Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/dJdqn5v4Dkw/mqdefault.jpg",
            "viewCount": "36756406",
            "duration": "PT2M21S"
        },
        {
            "videoId": "ft70sAYrFyY",
            "title": "NewJeans (뉴진스) 'Bubble Gum' Official MV",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2024-04-26T15:00:01Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/ft70sAYrFyY/mqdefault.jpg",
            "viewCount": "82118192",
            "duration": "PT3M41S"
        },
        {
            "videoId": "kKsivrgoyDw",
            "title": "NewJeans (뉴진스) 'Cool With You' Official MV (Performance ver.)",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2023-07-20T15:00:02Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/kKsivrgoyDw/mqdefault.jpg",
            "viewCount": "40556234",
            "duration": "PT2M28S"
        },
        {
            "videoId": "M5aEiDSx7kI",
            "title": "NewJeans (뉴진스) 'Supernatural' Lyrics (Color Coded Lyrics)",
            "channelTitle": "Jaeguchi",
            "publishedAt": "2024-06-21T06:43:41Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/M5aEiDSx7kI/mqdefault.jpg",
            "viewCount": "6380702",
            "duration": "PT3M11S"
        },
        {
            "videoId": "Ec0Z1v7jKDQ",
            "title": "NewJeans (뉴진스) ‘How Sweet’ Performance Video | Coke Studio",
            "channelTitle": "NewJeans",
            "publishedAt": "2024-05-24T15:00:01Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/Ec0Z1v7jKDQ/mqdefault.jpg",
            "viewCount": "26859546",
            "duration": "PT3M48S"
        },
        {
            "videoId": "pSUydWEqKwE",
            "title": "NewJeans (뉴진스) 'Ditto' Official MV (side A)",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2022-12-19T09:00:03Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/pSUydWEqKwE/mqdefault.jpg",
            "viewCount": "61704612",
            "duration": "PT5M34S"
        },
        {
            "videoId": "yFTAYXDTjqI",
            "title": "[K-Choreo 8K HDR] 뉴진스 직캠 'New Jeans' (NewJeans Choreography) @MusicBank 230714",
            "channelTitle": "KBS Kpop",
            "publishedAt": "2023-07-14T09:25:42Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/yFTAYXDTjqI/mqdefault.jpg",
            "viewCount": "12786854",
            "duration": "PT2M14S"
        },
        {
            "videoId": "s4Ow55AbdCg",
            "title": "NewJeans (뉴진스) 'ETA' Official MV (Performance ver.)",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2023-07-24T15:00:02Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/s4Ow55AbdCg/mqdefault.jpg",
            "viewCount": "76270011",
            "duration": "PT2M36S"
        },
        {
            "videoId": "bd5ZwEvrRSQ",
            "title": "EVEN THEY CAN'T BELIEVE IT 💀 #newjeans #njz #kpop",
            "channelTitle": "WIZBIT",
            "publishedAt": "2025-10-18T12:08:24Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/bd5ZwEvrRSQ/mqdefault.jpg",
            "viewCount": "6401579",
            "duration": "PT14S"
        },
        {
            "videoId": "sEsUxLkAYrg",
            "title": "NewJeans - Tell Me (Original song by Wonder Girls) l 2022 SBS Gayo Daejeon Ep 3",
            "channelTitle": "KOCOWA TV",
            "publishedAt": "2022-12-26T04:45:04Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/sEsUxLkAYrg/mqdefault.jpg",
            "viewCount": "14094755",
            "duration": "PT2M25S"
        },
        {
            "videoId": "6OMfjwK3X44",
            "title": "NewJeans - NewJeans [Audio]",
            "channelTitle": "BLISIT_OFFICIAL",
            "publishedAt": "2023-07-07T13:44:48Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/6OMfjwK3X44/mqdefault.jpg",
            "viewCount": "1389210",
            "duration": "PT1M50S"
        },
        {
            "videoId": "rp4KPJ_r5Pc",
            "title": "[Full Album] New Jeans - \"Get Up\"",
            "channelTitle": "KLINA's",
            "publishedAt": "2023-07-21T14:43:22Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/rp4KPJ_r5Pc/mqdefault.jpg",
            "viewCount": "12014920",
            "duration": "PT12M16S"
        },
        {
            "videoId": "n7ePZLn9_lQ",
            "title": "Super Shy",
            "channelTitle": "NewJeans - Topic",
            "publishedAt": "2023-07-21T04:00:32Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/n7ePZLn9_lQ/mqdefault.jpg",
            "viewCount": "141972485",
            "duration": "PT2M35S"
        },
        {
            "videoId": "DF3R2NNSqp4",
            "title": "New Jeans - NewJeans (뉴진스) [Music Bank] | KBS WORLD TV 230714",
            "channelTitle": "KBS WORLD TV",
            "publishedAt": "2023-07-14T09:16:23Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/DF3R2NNSqp4/mqdefault.jpg",
            "viewCount": "11656648",
            "duration": "PT2M21S"
        },
        {
            "videoId": "DrNtuAgwWgQ",
            "title": "NewJeans (뉴진스) 'Zero' Performance Video",
            "channelTitle": "NewJeans",
            "publishedAt": "2023-04-10T02:00:02Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/DrNtuAgwWgQ/mqdefault.jpg",
            "viewCount": "8698507",
            "duration": "PT2M43S"
        },
        {
            "videoId": "pDNltrE3LMo",
            "title": "ETA - NewJeans ニュージーンズ [Music Bank] | KBS WORLD TV 230804",
            "channelTitle": "KBS WORLD TV",
            "publishedAt": "2023-08-04T09:15:53Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/pDNltrE3LMo/mqdefault.jpg",
            "viewCount": "9124487",
            "duration": "PT2M38S"
        },
        {
            "videoId": "tVIXY14aJms",
            "title": "NewJeans (뉴진스) 'Hurt' Official MV",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2022-07-24T15:00:02Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/tVIXY14aJms/mqdefault.jpg",
            "viewCount": "54885559",
            "duration": "PT3M2S"
        },
        {
            "videoId": "FKHqiV-9xLA",
            "title": "NewJeans (뉴진스) 'Supernatural' Dance Practice",
            "channelTitle": "NewJeans",
            "publishedAt": "2024-07-24T10:00:01Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/FKHqiV-9xLA/mqdefault.jpg",
            "viewCount": "9317844",
            "duration": "PT3M15S"
        },
        {
            "videoId": "Q2yuALEEZuQ",
            "title": "파워퍼프걸로 변신한 뉴진스 🎀 𝙉𝙚𝙬𝙅𝙚𝙖𝙣𝙨 - 𝙉𝙚𝙬 𝙅𝙚𝙖𝙣𝙨 [한글 가사/해석]",
            "channelTitle": "이상한 나라의 매디",
            "publishedAt": "2023-07-07T05:58:23Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/Q2yuALEEZuQ/mqdefault.jpg",
            "viewCount": "19251735",
            "duration": "PT1M49S"
        },
        {
            "videoId": "Gw2jHej29QE",
            "title": "NewJeans (뉴진스) 'Hype Boy' Special Performance Video",
            "channelTitle": "NewJeans",
            "publishedAt": "2022-08-13T06:00:00Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/Gw2jHej29QE/mqdefault.jpg",
            "viewCount": "16065455",
            "duration": "PT3M3S"
        },
        {
            "videoId": "U8jQLE_mWGs",
            "title": "NewJeans 'New Jeans' Ι NPOP PREVIEW #1 230802",
            "channelTitle": "NPOP",
            "publishedAt": "2023-08-03T09:00:30Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/U8jQLE_mWGs/mqdefault.jpg",
            "viewCount": "5236742",
            "duration": "PT2M32S"
        },
        {
            "videoId": "86fJXRuP6Ko",
            "title": "NewJeans (뉴진스) – Supernatural @인기가요 inkigayo 20240714",
            "channelTitle": "SBSKPOP X INKIGAYO",
            "publishedAt": "2024-07-14T08:24:06Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/86fJXRuP6Ko/mqdefault.jpg",
            "viewCount": "2322772",
            "duration": "PT3M50S"
        },
        {
            "videoId": "m98euB9IxHU",
            "title": "New Jeans - Jersey Remix (Slowed)",
            "channelTitle": "HyperTunes",
            "publishedAt": "2025-02-25T17:47:41Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/m98euB9IxHU/mqdefault.jpg",
            "viewCount": "5409719",
            "duration": "PT1M50S"
        },
        {
            "videoId": "GUvZyGalLQg",
            "title": "Sweet #다니엘 🤫 #NewJeans #DANIELLE #NI_KI #ENHYPEN #SweetVenom",
            "channelTitle": "ENHYPEN",
            "publishedAt": "2024-02-20T11:04:35Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/GUvZyGalLQg/mqdefault.jpg",
            "viewCount": "10869211",
            "duration": "PT24S"
        },
        {
            "videoId": "wU2siJ2c5TA",
            "title": "NewJeans (뉴진스) 'Super Shy' Dance Practice",
            "channelTitle": "NewJeans",
            "publishedAt": "2023-07-07T09:00:01Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/wU2siJ2c5TA/mqdefault.jpg",
            "viewCount": "33013250",
            "duration": "PT2M42S"
        },
        {
            "videoId": "Y8mML3ZphlI",
            "title": "It’s giving NEWJEANS😲#NewJeans #뉴진스#NewJeans_NewJeans #NewJeans_GetUp#Time_to_NewJeans",
            "channelTitle": "NewJeans",
            "publishedAt": "2023-07-12T08:05:17Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/Y8mML3ZphlI/mqdefault.jpg",
            "viewCount": "44791392",
            "duration": "PT14S"
        },
        {
            "videoId": "haCpjUXIhrI",
            "title": "NewJeans 'Ditto' Lyrics (뉴진스 Ditto 가사) (Color Coded Lyrics)",
            "channelTitle": "Jaeguchi",
            "publishedAt": "2022-12-19T10:15:55Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/haCpjUXIhrI/mqdefault.jpg",
            "viewCount": "25534904",
            "duration": "PT3M7S"
        },
        {
            "videoId": "A4S8zl50AdM",
            "title": "NewJeans (뉴진스) ‘Supernatural’ Official MV (Part.2)",
            "channelTitle": "HYBE LABELS",
            "publishedAt": "2024-07-04T15:00:01Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/A4S8zl50AdM/mqdefault.jpg",
            "viewCount": "10773972",
            "duration": "PT3M11S"
        },
        {
            "videoId": "ueRPcfvo2ts",
            "title": "NEW JEANS - JERSEY REMIX #nightlyrics #evelyn #newjeans #newjeans",
            "channelTitle": "Night Lyrics ",
            "publishedAt": "2025-02-21T16:50:36Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/ueRPcfvo2ts/mqdefault.jpg",
            "viewCount": "2713907",
            "duration": "PT12S"
        },
        {
            "videoId": "AqmjGgVFiB0",
            "title": "New jeans is disbanding!?!?!!! #newjeans #kpop #kpopfypp #kpopnews #news",
            "channelTitle": "Chae",
            "publishedAt": "2024-11-21T23:43:27Z",
            "thumbnailUrl": "https://i.ytimg.com/vi/AqmjGgVFiB0/mqdefault.jpg",
            "viewCount": "498478",
            "duration": "PT46S"
        }
    ]
}

const formatViews = (viewCount) => {
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

const formatPublishedAgo = (publishedAt) => {
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

const formatVideoDuration = (duration) => {
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






const WatchTogetherInterface = ({ isOpen }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [searchResults, setSearchResults] = useState([]);

    const [videoQueue, setVideoQueue] = useState([]);
    const [currentQueueIndex, setCurrentQueueIndex] = useState(-1); // currentQeueueIndex -1 means theres nothing in the queue or nothing is selected - representsindex of the video currently playing
    const [openQueueMenuIndex, setOpenQueueMenuIndex] = useState(null);
    const [queueMenuPosition, setQueueMenuPosition] = useState(null);

    const [playerError, setPlayerError] = useState("");

    const panelRef = useRef(null);
    const queueMenuRef = useRef(null);
    const playerHostRef = useRef(null); // the div where the youtube iframe will be placed
    const playerRef = useRef(null);
    const playerReadyRef = useRef(false);

    const pendingVideoIdRef = useRef(""); // represents the "latest desired video" buffer for timing gaps - exists because currentVideoId can change before YT player is ready
    const videoQueueRef = useRef([]);

    const closeWatchTogether = useGameStore((state) => state.closeWatchTogether);

    const hasQueuedVideos = videoQueue.length > 0;
    const currentQueuedVideo = currentQueueIndex >= 0 ? (videoQueue[currentQueueIndex] ?? null) : null;
    const currentVideoId = currentQueuedVideo?.videoId ?? "";
    
    // blur any currently focused element inside the panel
    const blurFocusedPanelElement = () => {
        // if focus is on the Document itself or body/html, can fail strict HTMLElement assumptions,
        // or another example is if focus is inside SVG element (SVGElement, not HTMLElement)
        if (!(document.activeElement instanceof HTMLElement)) {
            return;
        }

        if (panelRef.current?.contains(document.activeElement)) {
            document.activeElement.blur();
        }
    };

    useEffect(() => {
        videoQueueRef.current = videoQueue;
    }, [videoQueue]);

    // blur any focused element when WatchTogetherInterface is closed
    useEffect(() => {
        if (!isOpen) {
            blurFocusedPanelElement();
            setOpenQueueMenuIndex(null);
            setQueueMenuPosition(null);
        }
    }, [isOpen]);

    // set event listener for escape press to close WatchTogetherInterface
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleEscapeToClose = (event) => {
            if (event.key !== "Escape") {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            closeWatchTogether();
        };

        window.addEventListener("keydown", handleEscapeToClose, true);
        return () => {
            window.removeEventListener("keydown", handleEscapeToClose, true);
        };
    }, [closeWatchTogether, isOpen]);

    // attach listeners to handle the queue element menus
    useEffect(() => {
        if (openQueueMenuIndex === null) {
            return;
        }

        const closeQueueMenu = () => {
            setOpenQueueMenuIndex(null);
            setQueueMenuPosition(null);
        };

        const handlePointerDown = (event) => {
            // return if the current node is a descendant of the queue menu, so we don't close the menu
            if (queueMenuRef.current?.contains(event.target)) {
                return;
            }

            closeQueueMenu();
        };

        // third arg true means lsitener is registered in the capture phase (not the default bubble phase)
        // capture lets the window listener catch scroll events from nested scrollable elements too
        window.addEventListener("pointerdown", handlePointerDown, true);
        window.addEventListener("scroll", closeQueueMenu, true);
        window.addEventListener("resize", closeQueueMenu);

        return () => {
            window.removeEventListener("pointerdown", handlePointerDown, true);
            window.removeEventListener("scroll", closeQueueMenu, true);
            window.removeEventListener("resize", closeQueueMenu);
        };
    }, [openQueueMenuIndex]);

    // keeps current queue index valid whenever the queue length changes
    // ex: if queue length shrinks and index is out of bounds --> clamp to last valid index
    useEffect(() => {
        if (videoQueue.length === 0) {
            setCurrentQueueIndex(-1);
            return;
        }

        setCurrentQueueIndex((previousIndex) => {
            if (previousIndex < 0) {
                return 0;
            }
            if (previousIndex >= videoQueue.length) {
                return videoQueue.length - 1;
            }
            return previousIndex;
        });
    }, [videoQueue.length]);

    // destroy the youtbe player if there is nothing to play (hasQueuedVideos === false)
    useEffect(() => {
        if (hasQueuedVideos) {
            return;
        }

        if (playerRef.current) {
            playerRef.current.destroy();
            playerRef.current = null;
        }

        playerReadyRef.current = false;
        pendingVideoIdRef.current = "";
    }, [hasQueuedVideos]);

    // create the player and play the first video if the user queued videos
    useEffect(() => {
        if (!hasQueuedVideos || !playerHostRef.current || playerRef.current) {
            return;
        }

        // cancelled is set to true if component suddenly unmounts (useful while player is loading)
        let cancelled = false;

        getYoutubeIframeApi()
            .then((YT) => {
                if (cancelled || !playerHostRef.current || playerRef.current) {
                    return;
                }

                playerRef.current = new YT.Player(playerHostRef.current, {
                    width: "100%",
                    height: "100%",
                    playerVars: {
                        controls: 1,
                        disablekb: 1,
                        fs: 0,
                        playsinline: 1,
                    },
                    events: {
                        onReady: () => {
                            playerReadyRef.current = true;

                            // pendingVideoIdRef.current is falsy when video that the player loaded is caught up to currentVideoId
                            const nextVideoId = pendingVideoIdRef.current || currentVideoId;
                            if (nextVideoId) {
                                playerRef.current?.loadVideoById(nextVideoId);
                                pendingVideoIdRef.current = "";
                            }
                        },
                        onStateChange: (event) => {
                            // only handle case where the video ended - to autoplay next video (if next video exists)
                            if (event.data !== window.YT.PlayerState.ENDED) {
                                return;
                            }

                            setCurrentQueueIndex((previousIndex) => {
                                const nextIndex = previousIndex + 1;
                                // this is true when no valid current video is selected (-1 state), or we're already at the last qeuued video so advancing would go out of bounds
                                if (previousIndex < 0 || nextIndex >= videoQueueRef.current.length) {
                                    return previousIndex;
                                }
                                return nextIndex;
                            });
                        },
                    },
                });
            })
            .catch((error) => {
                if (cancelled) {
                    return;
                }

                setPlayerError(error instanceof Error ? error.message : "Failed to load YouTube player.");
            });

        return () => {
            cancelled = true;
        };
    }, [currentVideoId, hasQueuedVideos]);

    // update video that the player loads and plays based on the currentVideoId state
    useEffect(() => {
        if (!currentVideoId) {
            return;
        }

        // why this exists:
        // stores the target video while player is still booting
        // if currentVideoId changes before onReady, pending is updated to the latest id
        pendingVideoIdRef.current = currentVideoId;

        // when the first video is queued, the player hasn't loaded yet
        // so we avoid loading the video twice since the player onVideo
            // note race condition with the player init useEffect is effectively not possible because the promise HAS to run first, and that's async
            // thread will then transfer focus over to this useEffect
        if (!playerRef.current || !playerReadyRef.current) {
            return;
        }

        // loadedVideoId = true loaded video that player is currently playing
        // currentVideoId is the video id of the state
        const loadedVideoId = String(playerRef.current.getVideoData?.()?.video_id ?? "");
        console.log(loadedVideoId)

        // these differ when React state has moved to a new target video but the YT player is still on the old one (or none yet)
        if (loadedVideoId === currentVideoId) {
            pendingVideoIdRef.current = "";
            return;
        }

        playerRef.current.loadVideoById(currentVideoId);
        pendingVideoIdRef.current = "";
    }, [currentVideoId]);

    // handle player cleanup when component unmounts
    useEffect(() => {
        return () => {
            if (playerRef.current) {
                playerRef.current.destroy();
                playerRef.current = null;
            }

            playerReadyRef.current = false;
            pendingVideoIdRef.current = "";
        };
    }, []);

    const handleQueueVideo = useCallback((video) => {
        if (!video?.videoId) {
            return;
        }

        setPlayerError("");
        setVideoQueue((previousQueue) => [...previousQueue, video]);
        setCurrentQueueIndex((previousIndex) => (previousIndex < 0 ? 0 : previousIndex));
    }, []);

    const handleQueueItemClick = useCallback((queueIndex) => {
        const safeQueueIndex = Number(queueIndex);
        if (!Number.isInteger(safeQueueIndex)) {
            return;
        }

        if (safeQueueIndex < 0 || safeQueueIndex >= videoQueueRef.current.length) {
            return;
        }

        setCurrentQueueIndex(safeQueueIndex);
    }, []);

    const handleQueueMenuToggle = useCallback((queueIndex, anchorElement) => {
        const safeQueueIndex = Number(queueIndex);
        if (!Number.isInteger(safeQueueIndex)) {
            return;
        }

        if (!(anchorElement instanceof HTMLElement)) {
            return;
        }

        if (openQueueMenuIndex === safeQueueIndex) {
            setOpenQueueMenuIndex(null);
            setQueueMenuPosition(null);
            return;
        }

        // position the queue menu relative to the given anchorElement
        const anchorRect = anchorElement.getBoundingClientRect();
        setQueueMenuPosition({
            left: anchorRect.left,
            top: anchorRect.top,
        });
        setOpenQueueMenuIndex(safeQueueIndex);

    }, [openQueueMenuIndex]);

    const handleQueueItemDelete = useCallback((queueIndex) => {
        const safeQueueIndex = Number(queueIndex);
        if (!Number.isInteger(safeQueueIndex)) {
            return;
        }

        setVideoQueue((previousQueue) => {
            if (safeQueueIndex < 0 || safeQueueIndex >= previousQueue.length) {
                return previousQueue;
            }

            const nextQueue = previousQueue.filter((_video, index) => index !== safeQueueIndex);

            setCurrentQueueIndex((previousIndex) => {
                if (nextQueue.length === 0) {
                    return -1;
                }

                if (previousIndex < 0) {
                    return 0;
                }

                // handles the case where deleted video is the current video
                if (previousIndex === safeQueueIndex) {
                    return Math.min(safeQueueIndex, nextQueue.length - 1);
                }

                // if the video to delete comes before the curernt video, shift the current video index back by 1
                if (previousIndex > safeQueueIndex) {
                    return previousIndex - 1;
                }

                return previousIndex;
            });

            return nextQueue;
        });

        setOpenQueueMenuIndex(null);
        setQueueMenuPosition(null);
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (isSearching) {
            return;
        }

        const safeQuery = searchInput.trim();
        if (!safeQuery) {
            setSearchResults([]);
            setSearchError("");
            return;
        }

        setIsSearching(true);
        setSearchError("");

        try {
            // const response = await fetch(`${SERVER_BASE_URL}/api/youtube/search?q=${encodeURIComponent(safeQuery)}`);
            // const payload = await response.json().catch(() => null);

            // if (!response.ok) {
            //     const errorMessage = String(payload?.message ?? "Failed to fetch YouTube videos.");
            //     throw new Error(errorMessage);
            // }

            const payload = await new Promise((resolve) => {
                setTimeout(() => {
                    resolve(tempSearchResults);
                }, 1000)
            })

            const safeItems = Array.isArray(payload.items) ? payload.items : [];
            setSearchResults(safeItems);
        } catch (error) {
            setSearchResults([]);
            setSearchError(error instanceof Error ? error.message : "Failed to fetch YouTube videos.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleClose = () => {
        closeWatchTogether();
    };

    // since input keystrokes update component state, we don't want to rerender the entire search results
    // without useMemo, every render rebuilds all result card JSX with map() even when searchResults didn't change
    const renderedSearchResults = useMemo(() => {
        return searchResults.map((video) => (
            <li key={video.videoId} className="h-full">
                <button
                    type="button"
                    onClick={() => handleQueueVideo(video)}
                    className="group w-full h-full flex items-start text-left rounded-lg border border-white/10 bg-white/3 p-2 
                        hover:bg-white/7 transition-colors cursor-pointer"
                >
                    <div className="flex flex-col gap-2 w-full">
                        <div className="relative w-full aspect-video rounded-md overflow-hidden">
                            {video.thumbnailUrl ? (
                                <img
                                    className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                                    src={video.thumbnailUrl}
                                    alt={video.title || "YouTube thumbnail"}
                                    loading="lazy" // tells browser to delay loading this image until it's near the viewport instead of loading immediately
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-[11px] bg-black/40 text-white/60">
                                    No thumbnail
                                </div>
                            )}
                            <div className="pointer-events-none absolute inset-0 z-10 bg-black/0 opacity-0 transition-all duration-300 ease-out group-hover:bg-black/45 group-hover:opacity-100">
                                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full 
                                      bg-primary/20 border border-primary/65 
                                        text-3xl leading-none font-medium text-white transition-transform duration-300 ease-out scale-90 group-hover:scale-100">
                                    +
                                </span>
                                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-4 text-xs tracking-wide uppercase text-white 
                                    transition-all duration-300 ease-out group-hover:translate-y-5">
                                    Add to queue
                                </span>
                            </div>
                            {formatVideoDuration(video.duration) && (
                                <span className="absolute z-20 right-1 bottom-1 rounded bg-black/80 px-1 py-0.5 text-xs leading-none text-white">
                                    {formatVideoDuration(video.duration)}
                                </span>
                            )}
                        </div>

                        <div className="min-w-0">
                            <p className="text-sm font-medium leading-5 max-h-10 overflow-hidden">
                                {video.title || "Untitled video"}
                            </p>
                            <p className="mt-1 text-xs text-white/75 truncate">
                                {video.channelTitle || "Unknown channel"}
                            </p>
                            <p className="mt-1 text-xs text-white/60">
                                {formatViews(video.viewCount)} • {formatPublishedAgo(video.publishedAt)}
                            </p>
                        </div>
                    </div>
                </button>
            </li>
        ));
    }, [handleQueueVideo, searchResults]);

    const renderedQueueItems = useMemo(() => {
        return videoQueue.map((video, queueIndex) => {
            const isNowPlaying = queueIndex === currentQueueIndex;

            return (
                <li 
                    key={`${video.videoId}-${queueIndex}`}
                    className="relative group"
                >
                    <div
                        className={`flex flex-row items-center p-2 pl-0 border rounded-lg transition-colors ${
                            isNowPlaying
                                    ? "border-primary/70 bg-primary/12 hover:bg-primary/16 active:bg-primary/8"
                                    : "border-white/10 bg-white/3 hover:bg-white/7 active:bg-white/5"
                    }`}
                    >
                        {/* queue index */}
                        <p className="w-6 shrink-0 text-center text-xs tabular-nums text-white/75 select-none">
                            {queueIndex + 1}
                        </p>

                        {/* video info */}
                        <button
                            type="button"
                            onClick={() => handleQueueItemClick(queueIndex)}
                            className={`w-full pr-7 text-left hover:cursor-pointer`}
                        >
                            <div className="flex flex-row gap-3 h-20">
                                <div className="relative h-full shrink-0 overflow-hidden rounded-md bg-black/40 aspect-video">
                                    {video.thumbnailUrl ? (
                                        <img
                                            className="w-full h-full object-cover"
                                            src={video.thumbnailUrl}
                                            alt={video.title || "Queue thumbnail"}
                                            loading="lazy" // tells browser to delay loading this image until it's near the viewport instead of loading immediately
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[11px] text-white/60">
                                            No thumbnail
                                        </div>
                                    )}
                                    {formatVideoDuration(video.duration) && (
                                        <span className="absolute z-20 right-1 bottom-1 rounded bg-black/80 px-1 py-0.5 text-xs leading-none text-white">
                                            {formatVideoDuration(video.duration)}
                                        </span>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium leading-5 line-clamp-2">
                                        {video.title || "Untitled video"}
                                    </p>
                                    <p className="mt-1 text-xs text-white/75 truncate">
                                        {video.channelTitle || "Unknown channel"}
                                    </p>
                                    {/* <p className="mt-1 text-xs text-white/60 truncate">
                                        {formatViews(video.viewCount)} • {formatPublishedAgo(video.publishedAt)}
                                    </p> */}
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* queue element menu toggle */}
                    <div className="absolute right-2 top-2">
                        <button
                            type="button"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleQueueMenuToggle(queueIndex, event.currentTarget);
                            }}
                            onPointerDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                            }}
                            aria-haspopup="menu" // tells screen readers this button opens a menu
                            aria-expanded={openQueueMenuIndex === queueIndex} // tells screen reader whether the menu is currently open or closed
                            aria-label={`Queue actions for video ${queueIndex + 1}`}
                            className={`flex items-center justify-center h-7 w-7 rounded-[14px] border bg-gray-400/20 border-gray-300/20 text-sm leading-none transition-all
                                cursor-pointer hover:bg-gray-300/30 hover:border-gray-200/50 active:bg-gray-500/30 active:border-gray-400/30
                            ${
                                openQueueMenuIndex === queueIndex
                                    ? "opacity-100"
                                    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                            }`}
                        >
                            •••
                        </button>
                    </div>
                </li>
            );
        });
    }, [currentQueueIndex, handleQueueItemClick, handleQueueMenuToggle, openQueueMenuIndex, videoQueue]);

    const searchContent = (
        <>
            {isSearching && (
                <p className="text-sm text-white/70">Searching...</p>
            )}

            {!isSearching && searchError && (
                <p className="text-sm text-red-300">{searchError}</p>
            )}

            {!isSearching && !searchError && searchResults.length === 0 && (
                <p className="text-sm text-white/70">Search for a YouTube video to see results.</p>
            )}

            {!isSearching && !searchError && searchResults.length > 0 && (
                <ul className={`grid gap-3 ${hasQueuedVideos ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}>
                    {renderedSearchResults}
                </ul>
            )}
        </>
    );

    return (
        <div
            className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-200 ease-out ${
                isOpen ? "pointer-events-auto opacity-100 bg-[rgba(16,16,16,0.3)]" : "pointer-events-none opacity-0 bg-[rgba(16,16,16,0)]"
            }`}
        >
            <section
                ref={panelRef}
                className={`relative flex flex-col w-[min(95vw,70rem)] h-[min(80vh,40rem)] rounded-lg border border-white/15 bg-[rgba(41,41,41,0.9)] p-4 text-white shadow-2xl transition-all duration-200 ease-out ${
                    isOpen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
            >
                {/* headers and inputs */}
                <div className="grid items-center gap-3 
                    grid-cols-[auto_minmax(9.5rem,1fr)_auto]
                    md:grid-cols-[clamp(10rem,16vw,12rem)_minmax(9.5rem,1fr)_clamp(1.5rem,16vw,12rem)]"
                >
                    {/* title */}
                    <div className="flex flex-row gap-1 items-center whitespace-nowrap">
                        <img className="w-9 h-9" src={ShibaInuFace} alt="Shiba Inu logo" />
                        <p className="text-sm truncate">Watch_3_Gether</p>
                    </div>

                    {/* inputs */}
                    <div className="flex flex-row gap-3 w-full min-w-0 justify-center">
                        {/* search input */}
                        <form 
                            onSubmit={handleSubmit}
                            className="font-['Roboto'] relative w-full max-w-lg flex flex-row items-stretch"
                        >
                            <input 
                                type="text" 
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                className="w-full p-2.5 text-xs rounded-l-full rounded-r-none bg-[rgba(41,41,41,0.8)] border border-white/30 outline-none
                                     focus:border-primary transition-colors duration-100 ease-out"
                                placeholder="Search or paste Youtube URL"
                            />
                            <button 
                                type="submit"
                                disabled={isSearching}
                                aria-label="Search videos"
                                className="hover:cursor-pointer w-14 bg-[rgba(94,94,94,0.6)] rounded-r-full rounded-l-none flex items-center justify-center
                                    transition-colors duration-100 hover:bg-[rgba(94,94,94,0.8)] active:bg-[rgba(94,94,94,0.6)]"
                            >
                                <SearchIcon className="h-4 w-4 -translate-x-1"/>
                            </button>
                        </form>
                    </div>

                    {/* close */}
                    <button 
                        type="button"
                        className="w-6 h-auto justify-self-end hover:cursor-pointer 
                            transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-100 hover:opacity-95 active:opacity-90"
                        onMouseDown={(event) => event.preventDefault()} // prevent close button from taking mouse focus
                        onClick={handleClose}
                    >
                        <CloseIcon />
                    </button>
                </div>

                {/* if queuedVideos, left side player + queue - right side search results. Else, all search results */}
                {hasQueuedVideos ? (
                    <div className="font-['Roboto'] mt-4 flex-1 min-h-0 grid grid-cols-1 gap-4 xs:grid-cols-[minmax(20rem,2fr)_minmax(0,3fr)]">
                        {/* player + queue */}
                        <div className="min-h-0 flex flex-col">
                            <div className="w-full overflow-hidden rounded-lg border border-white/20 bg-black aspect-video">
                                <div ref={playerHostRef} className="w-full h-full" />
                            </div>

                            {playerError ? (
                                <p className="mt-2 text-sm text-red-300">{playerError}</p>
                            ) : null}

                            <div className="mt-3 flex items-center justify-between gap-3">
                                <p className="text-md font-medium text-white/90">Shared Queue</p>
                                <p className="text-xs tracking-wide text-white/60">Video {currentQueueIndex + 1}/{videoQueue.length}</p>
                            </div>

                            <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1 app-scroll">
                                <ul className="flex flex-col gap-2">
                                    {renderedQueueItems}
                                </ul>
                            </div>
                        </div>

                        {/* search content */}
                        <div className="min-h-0 overflow-y-auto pr-1 app-scroll">
                            {isOpen ? searchContent : null}
                        </div>
                    </div>
                ) : (
                    // search content
                    <div className="font-['Roboto'] mt-4 flex-1 min-h-0 overflow-y-auto pr-1 app-scroll">
                        {isOpen ? searchContent : null}
                    </div>
                )}
            </section>

            {isOpen && openQueueMenuIndex !== null && queueMenuPosition && typeof document !== "undefined"
                ? createPortal(
                    <div
                        ref={queueMenuRef}
                        className="font-['Roboto'] fixed z-50 min-w-40 overflow-hidden rounded-[14px] border border-white/15 bg-[rgba(22,22,22,0.95)] shadow-lg
                            "
                        style={{
                            left: `${queueMenuPosition.left}px`,
                            top: `${queueMenuPosition.top}px`,
                        }}
                    >
                        <button
                            type="button"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleQueueItemDelete(openQueueMenuIndex);
                            }}
                            className="flex flex-row gap-2 w-full px-3 py-2 text-left text-md text-white transition-colors hover:bg-red-500/15 hover:text-red-100
                                hover:cursor-pointer"
                        >
                            <DeleteIcon classname="w-6 h-6"/>
                            <p>Delete</p>
                        </button>
                    </div>,
                    document.body
                )
                : null}
        </div>
    );
};

export default WatchTogetherInterface
