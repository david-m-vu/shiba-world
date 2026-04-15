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
import PersonIcon from "../assets/icons/person.svg?react";

const SERVER_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

const getCapacityClass = (playerCount, maxPlayers) => {
    if (!Number.isFinite(playerCount) || !Number.isFinite(maxPlayers) || maxPlayers <= 0) {
        return "text-[#A6A6A6]";
    }

    
    const capacityRatio = playerCount / maxPlayers;
    
    if (capacityRatio < 0.75) { // 0.75 = 6/8
        return "text-emerald-400/80";
    } 
    if (capacityRatio < 1) {
        return "text-amber-300/80";
    }
        
    return "text-rose-400/80";
}

const LandingJoin = () => {
    const localPlayerName = useGameStore((state) => state.localPlayerName);
    const [nameInput, setNameInput] = useState(localPlayerName ?? "");
    const [errorMessage, setErrorMessage] = useState("");
    const [pendingAction, setPendingAction] = useState("");
    const [roomStatus, setRoomStatus] = useState(null);
    const [roomStatusMessage, setRoomStatusMessage] = useState("");
    const [roomStatusPending, setRoomStatusPending] = useState(false);

    const nameRef = useRef(null);

    const joinRoom = useGameStore((state) => state.joinRoom);
    const navigate = useNavigate();
    const { roomId } = useParams();

    const safePlayerName = nameInput.trim();
    const isBusy = pendingAction !== "";

    const roomExists = roomStatus?.exists === true;
    const canJoinRoom = roomExists && !roomStatus?.isFull;
    const roomCapacityLabel = roomExists
        && Number.isFinite(roomStatus.playerCount)
        && Number.isFinite(roomStatus.maxPlayers)
        ? `${roomStatus.playerCount}/${roomStatus.maxPlayers}`
        : "";

    useEffect(() => {
        nameRef.current?.focus();
    }, []);

    useEffect(() => {
        const safeRoomId = String(roomId ?? "").trim();
        if (!safeRoomId) {
            setRoomStatus(null);
            setRoomStatusMessage("Room ID is required.");
            setRoomStatusPending(false);
            return;
        }

        // abortController is for cancelling an async operation - used for useEffect cleanup so old requests don't show up as stale. ignore is an extra guard
        let ignore = false;
        const abortController = new AbortController();

        const fetchRoomStatus = async () => {
            setRoomStatusPending(true);
            setRoomStatusMessage("");

            try {
                const response = await fetch(`${SERVER_BASE_URL}/api/rooms/${safeRoomId}/status`, {
                    signal: abortController.signal,
                });
                const responseJson = await response.json();

                // if ignore is set to true from useEffect cleanup, don't bother setting status and message since it will be stale
                if (ignore) {
                    return;
                }

                if (!responseJson.ok) {
                    setRoomStatus(null);
                    setRoomStatusMessage(responseJson.message ?? "Failed to check room status.");
                    return;
                }

                setRoomStatus(responseJson);

                if (!responseJson.exists) {
                    setRoomStatusMessage("room code not found.");
                    return;
                }

                if (responseJson.isFull) {
                    setRoomStatusMessage("room is full.");
                }

            } catch (error) {
                // avoid treating a deliberate abort as a real error
                if (ignore || error?.name === "AbortError") {
                    return;
                }

                setRoomStatus(null);
                setRoomStatusMessage(error instanceof Error ? error.message : "Failed to check room status.");

            } finally {
                if (!ignore) {
                    setRoomStatusPending(false);
                }
            }
        };

        fetchRoomStatus();

        return () => {
            ignore = true;
            abortController.abort();
        };
    }, [roomId]);

    // resync nameInput with localPlayername after persisted-state hydration
    useEffect(() => {
        setNameInput(localPlayerName ?? "");
    }, [localPlayerName]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!safePlayerName || isBusy || roomStatusPending || !canJoinRoom) {
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
                    <div className="flex flex-row items-center gap-4">
                        <p>joining room <span className="text-primary">{roomId}</span></p>
                        {roomStatusPending ? (
                            <p className="text-base text-[#A6A6A6]">checking room...</p>
                        ) :
                            roomCapacityLabel && (
                                <div className={`${getCapacityClass(roomStatus.playerCount, roomStatus.maxPlayers)} flex flex-row items-center`}>
                                    <p className="">{roomCapacityLabel}</p>
                                    <PersonIcon className="w-7 h-auto self-end" />
                                </div>
                            )
                        }
                    </div>


                    <button
                        type="button"
                        onClick={() => navigate("/?mode=join")}
                        className="text-base text-[#A6A6A6] underline hover:cursor-pointer"
                    >
                        join a different room?
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
                    <ErrorMessageRow message={errorMessage || roomStatusMessage} />
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2.5">
                    <button
                        type="submit"
                        disabled={isBusy || safePlayerName === "" || roomStatusPending || !canJoinRoom}
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
