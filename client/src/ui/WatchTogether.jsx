import { useEffect } from "react";
import { useGameStore } from "../store/useGameStore.js";

const WatchTogether = () => {
    const closeWatchTogether = useGameStore((state) => state.closeWatchTogether);

    useEffect(() => {
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
    }, [closeWatchTogether]);

    return (
        <div className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-[rgba(16,16,16,0.45)]">
            <section className="relative w-[min(90vw,52rem)] h-[min(80vh,34rem)] rounded-2xl border border-white/20 bg-[rgba(41,41,41,0.9)] p-6 text-white shadow-2xl">
                <button
                    type="button"
                    aria-label="Close watch together panel"
                    className="absolute right-3 top-3 cursor-pointer rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm text-white hover:bg-white/20"
                    onClick={closeWatchTogether}
                >
                    Close
                </button>

                <h2 className="text-xl font-semibold">Watch Together</h2>
            </section>
        </div>
    );
};

export default WatchTogether
