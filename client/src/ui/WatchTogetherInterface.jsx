import { useEffect } from "react";
import { useGameStore } from "../store/useGameStore.js";

import CloseIcon from "../assets/icons/close.svg?react";
import ShibaInuFace from "../assets/icons/shiba-inu.png"

const WatchTogetherInterface = () => {
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
        <div className="pointer-events-auto absolute inset-0 z-10 flex items-center justify-center bg-[rgba(16,16,16,0.3)]">
            <section className="relative w-[min(95vw,70rem)] h-[min(80vh,40rem)] rounded-lg border border-white/15 bg-[rgba(41,41,41,0.9)] p-4 text-white shadow-2xl">
                {/* headers and inputs */}
                <div className="grid items-center gap-3 
                    grid-cols-[auto_minmax(9.5rem,1fr)_auto]
                    md:grid-cols-[clamp(10rem,16vw,12rem)_minmax(9.5rem,1fr)clamp(1.5rem,16vw,12rem)]"
                >
                    {/* title */}
                    <div className="flex flex-row gap-1 items-center whitespace-nowrap">
                        <img className="w-9 h-9" src={ShibaInuFace} alt="Shiba Inu logo" />
                        <p className="text-sm truncate">Watch_3_Gether</p>
                    </div>

                    {/* inputs */}
                    <div className="flex flex-row gap-3 w-full min-w-0 justify-center">
                        {/* search input */}
                        <form className="font-['Roboto'] relative w-full max-w-lg">
                            <input 
                                type="text" 
                                className="w-full p-2.5 text-xs rounded-4xl bg-[rgba(41,41,41,0.8)] border border-white/30 outline-none"
                                placeholder="Search or paste Youtube URL"
                            />
                        </form>
                    </div>

                    {/* close */}
                    <button className="w-6 h-auto justify-self-end">
                        <CloseIcon />
                    </button>
                </div>
            </section>
        </div>
    );
};

export default WatchTogetherInterface
