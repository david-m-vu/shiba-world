/**
 * 2D UI overlay displaying landing page info and form inputs
 */
import { useRef, useState, useEffect } from "react";

import ShibaInuFace from "../assets/shiba-inu.png"
import { useGameStore } from "../store/useGameStore.js";

const Landing = () => {
    const [nameInput, setNameInput] = useState("");
    const nameRef = useRef(null);
    const createRoom = useGameStore((state) => state.createRoom);

    useEffect(() => {
        nameRef.current?.focus();
    }, [])

    const handleSubmit = (e) => {
        e.preventDefault();
        const playerName = nameInput.trim();
        if (!playerName) {
            return;
        }
        createRoom({ playerName });

        // TODO: connect socket to a room

        // TODO: generate a sharable link

    }

    return (
        <div className="absolute inset-0 flex flex-col justify-center items-center gap-6">
            {/* Title */}
            <div className="flex flex-row gap-2.5 px-5 py-2.5 justify-center items-center bg-[rgba(246,166,81,0.7)] rounded-4xl">
                <img src={ShibaInuFace} alt="Shiba Inu face" />
                <h1 className="text-[4rem]">SHIBA_WORLD</h1>
            </div>

            {/* Main card */}
            <div className="text-2xl text-center flex flex-col gap-5 px-10 py-10 bg-[rgba(29,29,29,0.7)] rounded-xl w-[clamp(375px,46rem,90vw)]">
                <p>create rooms, hang out, chat, and watch videos together in real time inside a virtual 3D world - no download required!</p>

                <hr />

                <form onSubmit={handleSubmit} className="flex flex-col items-center gap-10">
                    {/* inputs */}
                    <div className="flex flex-col items-center gap-5">
                        <div className="flex flex-col gap-2.5">
                            <label htmlFor="name">what's your name?</label>
                            <input 
                                ref={nameRef}
                                autoComplete="off"
                                type="text" 
                                name="name" 
                                id="name" 
                                placeholder="input name here..."
                                value={nameInput}
                                required
                                aria-invalid={nameInput.trim() === ""}
                                className="min-w-90 bg-white rounded-full py-1 px-4 text-black"
                                onChange={(e) => {
                                    setNameInput(e.target.value);
                                }}
                            />
                        </div>
                        <div className="flex flex-col items-center gap-5">
                            <div className="flex flex-col gap-2.5">
                                <p>choose a world type:</p>
                                <p className="text-[#A6A6A6]">(more worlds to be implemented)</p>
                            </div>
                        </div>
                    </div>

                    {/* buttons */}
                    <div className="flex flex-col gap-2.5">
                        <button 
                            type="submit"
                            className="py-1.5 px-15 rounded-full bg-primary hover:cursor-pointer"
                        >
                            create a room
                        </button>
                        <button type="button" className="text-primary disabled:hover:cursor-default hover:cursor-pointer underline" disabled>or join one...</button>
                    </div>
                </form>
            </div>


        </div>
    )
}

export default Landing;
