/**
 * 2D UI overlay displaying landing page info and form inputs
 * TODO: add message popup for socket or room errors
 * TODO: add join logic
 */
import { useRef, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

import { useGameStore } from "../store/useGameStore.js";
import ShibaInuFace from "../assets/shiba-inu.png";

const Landing = () => {
    const [nameInput, setNameInput] = useState("");
    const [roomCodeInput, setRoomCodeInput] = useState("");
    const [pendingAction, setPendingAction] = useState("");

    const nameRef = useRef(null);
    const roomCodeRef = useRef(null);
    
    const createRoom = useGameStore((state) => state.createRoom);
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const safePlayerName = nameInput.trim();
    const safeRoomCode = roomCodeInput.trim();
    const isBusy = pendingAction !== "";
    const isJoinMode = searchParams.get("mode") === "join";

    useEffect(() => {
        if (!isJoinMode) {
            nameRef.current?.focus();
        } else {
            roomCodeRef.current?.focus();
        }
    }, [isJoinMode])

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!safePlayerName || isBusy) {
            return;
        }

        setPendingAction("creating");
        const response = await createRoom({ playerName: safePlayerName, worldType: "default" });
        console.log("room created", response);
        setPendingAction("");

        // TODO: generate a sharable link

    }

    const handleSwitchMode = () => {
        setSearchParams((prev) => {
            const curSearchParams = new URLSearchParams(prev);
            const mode = curSearchParams.get("mode");
            if (!mode || mode !== "join") {
                curSearchParams.set("mode", 'join');
            } else {
                // set to create mode
                curSearchParams.delete("mode");
            }
            
            return curSearchParams;
        })
    };

    return (
        <div className="absolute inset-0 flex flex-col justify-center items-center gap-6">
            {/* Title */}
            <div className="flex flex-row gap-2.5 px-5 py-2.5 justify-center items-center bg-[rgba(246,166,81,0.7)] rounded-4xl">
                <img src={ShibaInuFace} alt="Shiba Inu face" />
                <h1 className="text-[4rem]">SHIBA_WORLD</h1>
            </div>

            {/* Main card */}
            <div className="text-2xl text-center flex flex-col gap-5 px-10 py-10 bg-[rgba(29,29,29,0.7)] rounded-xl w-[clamp(375px,46rem,90vw)]">
                {isJoinMode ?
                    <p>join a room</p>
                    :
                    <p>create rooms, hang out, chat, and watch videos together in real time inside a virtual 3D world - no download required!</p>
                }
                

                <hr />

                <form onSubmit={handleSubmit} className="flex flex-col items-center gap-10">
                    {/* inputs */}
                    <div className="flex flex-col items-center gap-5">
                        {!isJoinMode ?
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
                            :
                            <div className="flex flex-col gap-2.5">
                                <label htmlFor="room-code">room code</label>
                                <input 
                                    ref={roomCodeRef}
                                    autoComplete="off"
                                    type="text" 
                                    name="room-code" 
                                    id="room-code" 
                                    placeholder="enter room code..."
                                    value={roomCodeInput}
                                    required
                                    aria-invalid={safeRoomCode === ""}
                                    className="min-w-90 bg-white rounded-full py-1 px-4 text-black"
                                    onChange={(e) => {
                                        setRoomCodeInput(e.target.value);
                                    }}
                                />
                            </div>
                    
                        }
                        
                        {!isJoinMode && 
                            <div className="flex flex-col items-center gap-5">
                                <div className="flex flex-col gap-2.5">
                                    <p>choose a world type:</p>
                                    <p className="text-[#A6A6A6]">(more worlds to be implemented)</p>
                                </div>
                            </div>
                        }
                    </div>

                    {/* buttons */}
                    <div className="flex flex-col gap-2.5">
                        {isJoinMode ?
                            <button
                                type="button"
                                onClick={() => {
                                    navigate(`/rooms/${roomCodeInput}`)
                                }}
                                disabled={isBusy || safeRoomCode === ""}
                                className="py-1.5 px-15 rounded-full bg-primary transition-all duration-100 
                                    hover:cursor-pointer hover:brightness-110 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] 
                                    active:scale-[0.99] active:brightness-95 active:shadow-[0_4px_10px_rgba(0,0,0,0.2)] 
                                    disabled:opacity-70 disabled:hover:cursor-default disabled:hover:brightness-100 disabled:hover:shadow-none disabled:active:scale-100 disabled:active:brightness-100 disabled:active:shadow-none"
                            >
                                next
                            </button>
                            :
                            <button 
                                type="submit"
                                disabled={isBusy || safePlayerName === ""} 
                                className="py-1.5 px-15 rounded-full bg-primary transition-all duration-100 
                                    hover:cursor-pointer hover:brightness-110 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] 
                                    active:scale-[0.99] active:brightness-95 active:shadow-[0_4px_10px_rgba(0,0,0,0.2)] 
                                    disabled:opacity-70 disabled:hover:cursor-default disabled:hover:brightness-100 disabled:hover:shadow-none disabled:active:scale-100 disabled:active:brightness-100 disabled:active:shadow-none"
                            >
                                {pendingAction === "creating" ? "creating room..." : "create a room"}
                            </button>

                        }


                        <button
                            type="button"
                            className="text-primary hover:cursor-pointer underline"
                            onClick={handleSwitchMode}
                        >
                            {isJoinMode ? 
                                "or create one..." 
                                :
                                "or join one..."
                            }
                            
                        </button>
                    </div>
                </form>
            </div>


        </div>
    )
}

export default Landing;
