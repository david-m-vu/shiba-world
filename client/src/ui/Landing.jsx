/**
 * 2D UI overlay displaying landing page info and form inputs
 * TODO: add message popup for socket or room errors
 * TODO: add join logic
 */
import { useRef, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

import { useGameStore } from "../store/useGameStore.js";
import {
    ErrorMessageRow,
    LandingShell,
    LANDING_PRIMARY_BUTTON_CLASS,
    LANDING_SECONDARY_BUTTON_CLASS,
    NameInputField,
} from "../components/ui/LandingShared.jsx";

import Credits from "./Credits.jsx";

const SERVER_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

const Landing = () => {
    const localPlayerName = useGameStore((state) => state.localPlayerName);
    const isInRoom = useGameStore((state) => Boolean(state.currentRoomId));
    
    const [nameInput, setNameInput] = useState(localPlayerName ?? "");
    const [roomCodeInput, setRoomCodeInput] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [pendingAction, setPendingAction] = useState("");
    const [isCreditsOpen, setIsCreditsOpen] = useState(false);

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
    }, [isJoinMode]);

    useEffect(() => {
        if (!isCreditsOpen) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setIsCreditsOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isCreditsOpen]);

    // resync nameInput with localPlayername after persisted-state hydration
    useEffect(() => {
        setNameInput(localPlayerName ?? "");
    }, [localPlayerName]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isJoinMode) {
            if (!safeRoomCode || isBusy) {
                return;
            }

            setErrorMessage("");
            setPendingAction("verifying");
            try {
                const response = await fetch(`${SERVER_BASE_URL}/api/rooms/${safeRoomCode}/status`);
                const responseJson = await response.json();

                if (!responseJson.ok) {
                    setErrorMessage(responseJson.message);
                    return;
                }

                if (!responseJson.exists) {
                    setErrorMessage("room code not found.");
                    return;
                }

            } catch (error) {
                setErrorMessage(error instanceof Error ? error.message : "failed to check room status.");
                return;

            } finally {
                setPendingAction("");
            }

            navigate(`/rooms/${safeRoomCode}`);
            return;
        }

        if (!safePlayerName || isBusy) {
            return;
        }

        setPendingAction("creating");
        const response = await createRoom({ playerName: safePlayerName, worldType: "default" });
        if (!response.ok) {
            setErrorMessage(response.message);
            setPendingAction("");
            return;
        }

        setPendingAction("");
        navigate(`/rooms/${response.roomId}`);

    };

    const handleSwitchMode = () => {
        setErrorMessage("");
        setSearchParams((prev) => {
            const curSearchParams = new URLSearchParams(prev);
            const mode = curSearchParams.get("mode");

            if (!mode || mode !== "join") {
                curSearchParams.set("mode", "join");
            } else {
                // set to create mode
                curSearchParams.delete("mode");
            }

            return curSearchParams;
        });
    };

    
    if (isInRoom) {
        return null;
    }

    return (
        <>
            <LandingShell
                headerContent={
                    isJoinMode ? (
                        <p>join a room</p>
                    ) : (
                        <p>create rooms, hang out, chat, and watch videos together in real time inside a virtual 3D shiba world - no download required!</p>
                    )
                }
            >
                <form onSubmit={handleSubmit} className="flex flex-col items-center gap-5">
                    {/* inputs */}
                    <div className="flex flex-col items-center gap-5">
                        {!isJoinMode ? (
                            <NameInputField
                                inputRef={nameRef}
                                value={nameInput}
                                isInvalid={safePlayerName === ""}
                                onChange={(e) => {
                                    setNameInput(e.target.value);
                                    setErrorMessage("");
                                }}
                            />
                        ) : (
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
                                    className="min-w-80 xs2:min-w-85 xs:min-w-90 bg-white rounded-full py-1 px-4 text-black"
                                    onChange={(e) => {
                                        setRoomCodeInput(e.target.value);
                                        setErrorMessage("");
                                    }}
                                />
                                <ErrorMessageRow message={errorMessage} />
                            </div>
                        )}

                        {!isJoinMode && (
                            <div className="flex flex-col items-center gap-5">
                                <div className="flex flex-col gap-2.5">
                                    <p>choose a world type:</p>
                                    <p className="text-[#A6A6A6]">(more worlds to be implemented)</p>
                                    <ErrorMessageRow message={errorMessage} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* buttons */}
                    <div className="flex flex-col gap-2.5">
                        {isJoinMode ? (
                            <button
                                type="submit"
                                disabled={isBusy || safeRoomCode === ""}
                                className={LANDING_PRIMARY_BUTTON_CLASS}
                            >
                                {pendingAction === "verifying" ? "..." : "next"}
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={isBusy || safePlayerName === ""}
                                className={LANDING_PRIMARY_BUTTON_CLASS}
                            >
                                {pendingAction === "creating" ? "creating room..." : "create a room"}
                            </button>
                        )}

                        <button
                            type="button"
                            className={LANDING_SECONDARY_BUTTON_CLASS}
                            onClick={handleSwitchMode}
                        >
                            {isJoinMode ? "or create one..." : "or join one..."}
                        </button>
                    </div>
                </form>
            </LandingShell>

            <div className="fixed flex left-4 bottom-4 z-40 gap-2">
                <button
                    type="button"
                    onClick={() => setIsCreditsOpen(true)}
                    className="rounded-full border border-white/30 bg-black/60 px-4 py-2 text-sm text-white transition hover:cursor-pointer hover:bg-black/75"
                >
                    asset credits
                </button>
                <a
                    href="https://www.davidvu.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-white/30 bg-black/60 px-4 py-2 text-sm text-white transition hover:cursor-pointer hover:bg-black/75"
                >
                    created by david vu ↗
                </a>
            </div>

            {isCreditsOpen && (
                <Credits setIsCreditsOpen={setIsCreditsOpen}/>
            )}
        </>
    );
};

export default Landing;
