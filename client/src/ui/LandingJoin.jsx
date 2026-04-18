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

import BlackShibaThumb from "../assets/images/black_shiba_thumb.webp";
import BodyguardShibaThumb from "../assets/images/bodyguard_shiba_thumb.webp";
import ConstellationShibaThumb from "../assets/images/constellation_shiba_thumb.webp";
import ShibaThumb from "../assets/images/shiba_thumb.webp";

const SERVER_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

const AVATAR_SELECTION_OPTIONS = [
    {
        model: "shiba",
        label: "shiba",
        thumbnailSrc: ShibaThumb,
    },
    {
        model: "black_shiba",
        label: "black shiba",
        thumbnailSrc: BlackShibaThumb,
    },
    {
        model: "bodyguard_shiba",
        label: "bodyguard shiba",
        thumbnailSrc: BodyguardShibaThumb,
    },
    {
        model: "constellation_shiba",
        label: "constellation shiba",
        thumbnailSrc: ConstellationShibaThumb,
    },
];

const AVATAR_SELECTION_MODEL_SET = new Set(AVATAR_SELECTION_OPTIONS.map((option) => option.model));

const getCapacityClass = (playerCount, maxPlayers) => {
    if (!Number.isFinite(playerCount) || !Number.isFinite(maxPlayers) || maxPlayers <= 0) {
        return "text-[#A6A6A6]";
    }

    const capacityRatio = playerCount / maxPlayers;

    if (capacityRatio < 0.75) {
        return "text-emerald-400/80";
    }
    if (capacityRatio < 1) {
        return "text-amber-300/80";
    }

    return "text-rose-400/80";
};

const LandingJoin = () => {
    const localPlayerName = useGameStore((state) => state.localPlayerName);
    const localAvatarModel = useGameStore((state) => state.localAvatarModel);
    const currentRoomId = useGameStore((state) => state.currentRoomId);
    const avatarSelectionPending = useGameStore((state) => state.avatarSelectionPending);
    const setLocalAvatarModel = useGameStore((state) => state.setLocalAvatarModel);
    const completeAvatarSelection = useGameStore((state) => state.completeAvatarSelection);

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

    const isInRoom = Boolean(currentRoomId);
    const isViewingCurrentRoom = String(roomId ?? "") === String(currentRoomId ?? "");
    const showAvatarSelection = isInRoom && isViewingCurrentRoom && avatarSelectionPending;
    const selectedAvatarModel = AVATAR_SELECTION_MODEL_SET.has(localAvatarModel)
        ? localAvatarModel
        : "shiba";

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
        // in this case, the main LandingJoin UI shouldn't be shown - it should show the avatar selection screen
        if (showAvatarSelection || isInRoom) {
            return;
        }

        nameRef.current?.focus();
    }, [showAvatarSelection, isInRoom]);

    useEffect(() => {
        // in this case, the main LandingJoin UI shouldn't be shown - it should show the avatar selection screen
        if (showAvatarSelection || isInRoom) {
            return;
        }

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
    }, [roomId, showAvatarSelection, isInRoom]);

    // resync nameInput with localPlayername after persisted-state hydration
    useEffect(() => {
        setNameInput(localPlayerName ?? "");
    }, [localPlayerName]);

    useEffect(() => {
        if (!showAvatarSelection) {
            return;
        }

        if (selectedAvatarModel !== localAvatarModel) {
            setLocalAvatarModel(selectedAvatarModel);
        }
    }, [showAvatarSelection, selectedAvatarModel, localAvatarModel, setLocalAvatarModel]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!safePlayerName || isBusy || roomStatusPending || !canJoinRoom || isInRoom) {
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

    if (showAvatarSelection) {
        return (
            <LandingShell
                showTitle={false}
                headerContent={
                    <p>choose your avatar:</p>
                }
                mainCardClassName="w-[clamp(360px,50rem,90vw)]"
            >
                <div className="flex flex-col gap-5 justify-center">
                    <div className="grid grid-cols-2 md:grid-rows-1 md:grid-cols-4 gap-3 sm:gap-4">
                        {AVATAR_SELECTION_OPTIONS.map((option) => {
                            const isSelected = selectedAvatarModel === option.model;
                            return (
                                <button
                                    key={option.model}
                                    type="button"
                                    onClick={() => setLocalAvatarModel(option.model)}
                                    className={`cursor-pointer flex flex-col items-center rounded-xl border-2 p-2 transition-all duration-50 ${isSelected ? "border-primary bg-primary/20" : "border-white/15 bg-black/20 hover:border-white/40"}`}
                                >
                                    <img
                                        src={option.thumbnailSrc}
                                        alt={`${option.label} thumbnail`}
                                        className="h-24 w-full object-cover xs2:h-32 sm:h-32"
                                        draggable={false}
                                    />
                                    <p className="mt-2 text-sm xs2:text-base sm:text-lg">{option.label}</p>
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        onClick={() => completeAvatarSelection(selectedAvatarModel)}
                        className={`${LANDING_PRIMARY_BUTTON_CLASS} self-center w-fit`}
                    >
                        select
                    </button>
                </div>
            </LandingShell>
        );
    }

    if (isInRoom) {
        return null;
    }

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
                                    <p>{roomCapacityLabel}</p>
                                    <PersonIcon className="h-auto w-7 self-end" />
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
