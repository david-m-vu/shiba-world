import { roomExists } from "../world/rooms.js";

export const checkRoomExists = (request, response) => {
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

    return response.status(200).json({
        ok: true,
        exists: roomExists(roomId),
        roomId,
    });
}
