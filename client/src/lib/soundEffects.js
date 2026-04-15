import chatBarkClassicSoundUrl from "../assets/sounds/chat-bark-classic.wav";
import chatBarkCuteSoundUrl from "../assets/sounds/chat-bark-cute.wav";
import chatBarkSoundUrl from "../assets/sounds/chat-bark.wav";
import jumpSoundUrl from "../assets/sounds/jump-pop.wav";
import systemJoinSoundUrl from "../assets/sounds/system-join.ogg";
import systemLeaveSoundUrl from "../assets/sounds/system-leave.ogg";
import systemCreateSoundUrl from "../assets/sounds/system-create.ogg";

const chatNotificationAudioByUrl = new Map();
const CHAT_NOTIFICATION_SOUND_URLS = [
    chatBarkClassicSoundUrl,
    chatBarkCuteSoundUrl,
    chatBarkSoundUrl,
];

let jumpAudio = null;
let systemJoinAudio = null;
let systemLeaveAudio = null;
let systemCreateAudio = null;

const toSafeMasterVolume = (masterVolume = 1) => {
    const parsedVolume = Number(masterVolume);
    if (!Number.isFinite(parsedVolume)) {
        return 1;
    }

    return Math.max(0, Math.min(1, parsedVolume));
};

const applyAudioVolume = (audio, { baseVolume, masterVolume }) => {
    const safeBaseVolume = Math.max(0, Math.min(1, Number(baseVolume) || 0));
    const safeMasterVolume = toSafeMasterVolume(masterVolume);
    audio.volume = safeBaseVolume * safeMasterVolume;
};

const playAudio = (audio) => {
    audio.currentTime = 0;

    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
            // browser autoplay restrictions can reject playback until the page has user interaction
        });
    }
};

export const playChatSound = (masterVolume = 1) => {
    // safe way to check whether the code is running in a browser like environment - to avoid playing audio in non-browser environments
    if (typeof window === "undefined") {
        return;
    }

    try {
        const randomSoundUrl = CHAT_NOTIFICATION_SOUND_URLS[
            Math.floor(Math.random() * CHAT_NOTIFICATION_SOUND_URLS.length)
        ];

        let chatNotificationAudio = chatNotificationAudioByUrl.get(randomSoundUrl);
        if (!chatNotificationAudio) {
            chatNotificationAudio = new Audio(randomSoundUrl);
            chatNotificationAudio.preload = "auto"; // indicates that the whole media file can be downloaded, even if the user is not expected to use it - helps sound start faster
            chatNotificationAudioByUrl.set(randomSoundUrl, chatNotificationAudio);
        }

        applyAudioVolume(chatNotificationAudio, {
            baseVolume: 0.75,
            masterVolume,
        });
        chatNotificationAudio.playbackRate = 0.75 + Math.random() * 0.5; 
        playAudio(chatNotificationAudio);
    } catch {
        // no-op
    }
};

export const playJumpSound = (masterVolume = 1) => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        if (!jumpAudio) {
            jumpAudio = new Audio(jumpSoundUrl);
            jumpAudio.preload = "auto";
        }

        applyAudioVolume(jumpAudio, {
            baseVolume: 0.45,
            masterVolume,
        });
        jumpAudio.playbackRate = 0.96 + Math.random() * 0.1;
        playAudio(jumpAudio);
    } catch {
        // no-op
    }
};

export const playSystemCreateSound = (masterVolume = 1) => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        if (!systemCreateAudio) {
            systemCreateAudio = new Audio(systemCreateSoundUrl);
            systemCreateAudio.preload = "auto";
        }

        applyAudioVolume(systemCreateAudio, {
            baseVolume: 0.65,
            masterVolume,
        });
        systemCreateAudio.playbackRate = 1;
        playAudio(systemCreateAudio);
    } catch {
        // no-op
    }
}

export const playSystemJoinSound = (masterVolume = 1) => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        if (!systemJoinAudio) {
            systemJoinAudio = new Audio(systemJoinSoundUrl);
            systemJoinAudio.preload = "auto";
        }

        applyAudioVolume(systemJoinAudio, {
            baseVolume: 0.65,
            masterVolume,
        });
        systemJoinAudio.playbackRate = 1;
        playAudio(systemJoinAudio);
    } catch {
        // no-op
    }
};

export const playSystemLeaveSound = (masterVolume = 1) => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        if (!systemLeaveAudio) {
            systemLeaveAudio = new Audio(systemLeaveSoundUrl);
            systemLeaveAudio.preload = "auto";
        }

        applyAudioVolume(systemLeaveAudio, {
            baseVolume: 0.65,
            masterVolume,
        });
        systemLeaveAudio.playbackRate = 1;
        playAudio(systemLeaveAudio);
    } catch {
        // no-op
    }
};
