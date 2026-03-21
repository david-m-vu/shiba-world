import { useEffect, useRef, useState } from "react";

import { useGameStore } from "../../store/useGameStore.js";
import Toast from "./Toast.jsx";

const EXIT_ANIMATION_MS = 300;
const DEFAULT_TOAST_DURATION_MS = 5000;

const toSafeDuration = (durationMs) => {
    const parsedDuration = Number(durationMs);
    if (!Number.isFinite(parsedDuration) || parsedDuration < 0) {
        return DEFAULT_TOAST_DURATION_MS;
    }

    return parsedDuration;
};

const ToastItem = ({ id, type, message, durationMs, highlightText, onRemove }) => {
    // if we set isVisible to true immediately on mount, the browser may skip the transition because it never painted the hidden state first
    // this is for the initial fade in effect
    const [isVisible, setIsVisible] = useState(false); 
    const hasEnteredRef = useRef(false);

    // initial slide in effect on ToastItem mount
    useEffect(() => {
        // requreseAnimationFrame schedules the callback right before the next pain
        // initial render: isVisible = false
        // next frame: isVisible = true
        // if we set isVisible to true immediately on mount, the browser may skip the transition because it never painted the hidden state first
        const frameId = window.requestAnimationFrame(() => {
            hasEnteredRef.current = true;
            setIsVisible(true);
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, []);

    // hide after timeout
    useEffect(() => {
        if (!isVisible) {
            return undefined;
        }

        const hideTimeoutId = window.setTimeout(() => {
            setIsVisible(false);
        }, toSafeDuration(durationMs));

        return () => {
            window.clearTimeout(hideTimeoutId);
        };
    }, [durationMs, isVisible]);

    // remove toast only if toast is not visible + toast has already entered + EXIT_ANImATION_MS have passed
    useEffect(() => {
        if (!hasEnteredRef.current || isVisible) {
            return undefined;
        }

        const removeTimeoutId = window.setTimeout(() => {
            onRemove(id);
        }, EXIT_ANIMATION_MS);

        return () => {
            window.clearTimeout(removeTimeoutId);
        };
    }, [id, isVisible, onRemove]);

    return <Toast type={type} message={message} highlightText={highlightText} isVisible={isVisible} />;
};

const ToastContainer = () => {
    const toasts = useGameStore((state) => state.toasts);
    const removeToast = useGameStore((state) => state.removeToast);

    if (!toasts.length) {
        return null;
    }

    return (
        <div
            role="status" // marks element as a polite live region for non-urgent updates
            aria-live="polite"
            aria-atomic={false} // aria-atomic false means announce only the changed part when this div does change
            className="pointer-events-none fixed bottom-6 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
        >
            {toasts.map((toast) => (
                <ToastItem
                    key={toast.id}
                    id={toast.id}
                    type={toast.type}
                    message={toast.message}
                    durationMs={toast.durationMs}
                    highlightText={toast.highlightText}
                    onRemove={removeToast}
                />
            ))}
        </div>
    );
};

export default ToastContainer;
