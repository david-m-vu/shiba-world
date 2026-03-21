import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useGameStore } from "../store/useGameStore.js";
import ShibaInuFace from "../assets/shiba-inu.png";

const LandingJoin = () => {
    const [nameInput, setNameInput] = useState("");
    const [pendingAction, setPendingAction] = useState("");

    const nameRef = useRef(null);

    const joinRoom = useGameStore((state) => state.joinRoom);
    const navigate = useNavigate();
    const { roomId } = useParams();
    
    const safePlayerName = nameInput.trim();
    const isBusy = pendingAction !== "";

    useEffect(() => {
        nameRef.current?.focus();
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!safePlayerName || isBusy) {
            return;
        }

        // TODO: handle nonexistent roomId

        setPendingAction("joining");
        const response = await joinRoom({ roomId, playerName: safePlayerName });
        console.log(response);
        console.log(`joining room ${response.roomId}`);
        setPendingAction("");
    }
    
    return (
        <div className="absolute inset-0 flex flex-col justify-center items-center gap-6">
            {/* Title */}
            <div className="flex flex-row gap-2.5 px-5 py-2.5 justify-center items-center bg-[rgba(246,166,81,0.7)] rounded-4xl">
                <img src={ShibaInuFace} alt="Shiba Inu face" />
                <h1 className="text-[4rem]">SHIBA_WORLD</h1>
            </div>

            {/* Main Card */}
            <div className="text-2xl text-center flex flex-col gap-5 px-10 py-10 bg-[rgba(29,29,29,0.7)] rounded-xl w-[clamp(375px,46rem,90vw)]">
                <div className="flex flex-col items-center gap-1.5">
                    <p>joining room <span className="text-primary">{roomId}</span></p>
                    <button
                        type="button"
                        onClick={() => navigate("/?mode=join")}
                        className="text-base text-[#A6A6A6] underline hover:cursor-pointer"
                    >
                        wrong room?
                    </button>
                </div>

                <hr />

                <form onSubmit={handleSubmit} className="flex flex-col items-center gap-10">
                    {/* inputs */}
                    <div className="flex flex-col items-center gap-5">
                        <div className="flex flex-col gap-2.5">
                            <label htmlFor="name">what&apos;s your name?</label>
                            <input 
                                ref={nameRef}
                                autoComplete="off"
                                type="text" 
                                name="name" 
                                id="name" 
                                placeholder="enter name..."
                                value={nameInput}
                                required
                                aria-invalid={safePlayerName === ""}
                                className="min-w-90 bg-white rounded-full py-1 px-4 text-black"
                                onChange={(e) => {
                                    setNameInput(e.target.value);
                                }}
                            />
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex flex-col gap-2.5">
                        <button 
                            type="submit"
                            disabled={isBusy || safePlayerName === ""} 
                            className="py-1.5 px-15 rounded-full bg-primary transition-all duration-100 
                                hover:cursor-pointer hover:brightness-110 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] 
                                active:scale-[0.99] active:brightness-95 active:shadow-[0_4px_10px_rgba(0,0,0,0.2)] 
                                disabled:opacity-70 disabled:hover:cursor-default disabled:hover:brightness-100 disabled:hover:shadow-none disabled:active:scale-100 disabled:active:brightness-100 disabled:active:shadow-none"
                        >
                            {pendingAction === "joining" ? "joining room..." : "join room"}
                        </button>
                        
                        <button
                            type="button"
                            className="text-primary hover:cursor-pointer underline"
                            onClick={() => { navigate("/") }}
                        >
                            or create one...
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default LandingJoin;