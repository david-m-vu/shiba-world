import { getRoomStore } from "../world/room-store/index.js";

export const checkRoomExists = async (request, response) => {
    const roomStore = getRoomStore();
    const roomId = String(request.params.roomId ?? "").trim();
    if (!roomId) {
        response.status(400).json({
            ok: false,
            exists: false,
            roomId: null,
            message: "Room ID is required.",
        });
        return;
    }

    try {
        const exists = await roomStore.roomExists(roomId);
        return response.status(200).json({
            ok: true,
            exists,
            roomId,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check room status.";
        return response.status(500).json({
            ok: false,
            exists: false,
            roomId,
            message,
        });
    }
}

export const getRoomStatus = async (request, response) => {
    const roomStore = getRoomStore();
    const roomId = String(request.params.roomId ?? "").trim();
    if (!roomId) {
        response.status(400).json({
            ok: false,
            exists: false,
            roomId: null,
            message: "Room ID is required.",
        });
        return;
    }

    try {
        const roomStatus = await roomStore.getRoomPublicStatus(roomId);
        // if the room doesn't exist
        if (!roomStatus) {
            return response.status(200).json({
                ok: true,
                exists: false,
                roomId,
                playerCount: 0,
                maxPlayers: null,
                isFull: false,
            });
        }

        return response.status(200).json({
            ok: true,
            exists: true,
            roomId,
            playerCount: roomStatus.playerCount,
            maxPlayers: roomStatus.maxPlayers,
            isFull: roomStatus.isFull,
        });
        
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to check room status.";
        return response.status(500).json({
            ok: false,
            exists: false,
            roomId,
            message,
        });
    }
}
