import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { useGameStore } from "../store/useGameStore.js";
import {
    ErrorMessageRow,
    LandingShell,
    LANDING_PRIMARY_BUTTON_CLASS,
    LANDING_SECONDARY_BUTTON_CLASS,
    NameInputField,
} from "../components/ui/LandingShared.jsx";

const LandingJoin = () => {
    const [nameInput, setNameInput] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [pendingAction, setPendingAction] = useState("");

    const nameRef = useRef(null);

    const joinRoom = useGameStore((state) => state.joinRoom);
    const navigate = useNavigate();
    const { roomId } = useParams();

    const safePlayerName = nameInput.trim();
    const isBusy = pendingAction !== "";

    useEffect(() => {
        nameRef.current?.focus();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!safePlayerName || isBusy) {
            return;
        }

        setErrorMessage("");
        setPendingAction("joining");

        try {
            const response = await joinRoom({ roomId, playerName: safePlayerName });
            if (!response.ok) {
                setErrorMessage(response.message ?? "Failed to join room.");
                return;
            }

        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Failed to join room.");

        } finally {
            setPendingAction("");
        }
    };

    return (
        <LandingShell
            headerContent={
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
            }
        >
            <form onSubmit={handleSubmit} className="flex flex-col items-center gap-5">
                {/* inputs */}
                <div className="flex flex-col items-center gap-5">
                    <NameInputField
                        inputRef={nameRef}
                        value={nameInput}
                        isInvalid={safePlayerName === ""}
                        onChange={(e) => {
                            setNameInput(e.target.value);
                            setErrorMessage("");
                        }}
                    />
                    <ErrorMessageRow message={errorMessage} />
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2.5">
                    <button
                        type="submit"
                        disabled={isBusy || safePlayerName === ""}
                        className={LANDING_PRIMARY_BUTTON_CLASS}
                    >
                        {pendingAction === "joining" ? "joining room..." : "join room"}
                    </button>

                    <button
                        type="button"
                        className={LANDING_SECONDARY_BUTTON_CLASS}
                        onClick={() => {
                            navigate("/");
                        }}
                    >
                        or create one...
                    </button>
                </div>
            </form>
        </LandingShell>
    );
};

export default LandingJoin;
