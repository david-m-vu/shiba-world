/*
 * Notes:
 * currently we're using the socket id on connection as the player id, which means that after a refresh, they will get a new socket.id
 */

import {
    addChatMessage,
    applyWatchTogetherCommand,
    createRoom,
    getRoomIdBySocket,
    getRoomSnapshot,
    joinRoom,
    leaveRoom,
    updatePlayerState,
    updateWorldObjectState,
} from "../world/rooms.js";

// this function lets the client know that they just left a room
const emitDeparture = (io, socket, departureObj) => {
    if (!departureObj) {
        return;
    }

    // leave socket room
    socket.leave(departureObj.roomId);

    if (departureObj.roomDeleted) {
        return;
    }

    // if entire room wasn't deleted, emit to the entire room that this player (removed player's socket id) left
    io.to(departureObj.roomId).emit("player:left", {
        playerId: departureObj.removedPlayerId,
        hostSocketId: departureObj.nextHostSocketId,
    });

    if (departureObj.systemMessage) {
        io.to(departureObj.roomId).emit("chat:message", {
            message: departureObj.systemMessage,
        });
    }
};

// send respones back to client through the callback
const acknowledge = (callback, payload) => {
    if (typeof callback === "function") {
        callback(payload);
    }
};

const emitRoomError = (socket, callback, error) => {
    const message = error instanceof Error ? error.message : "Unknown room error.";
    socket.emit("room:error", { message });
    acknowledge(callback, { ok: false, message });
};

export const registerSocketHandlers = (io, socket) => {
    console.log(`${socket.id} connected`)

    // room:create does three things: leaves previous room (if any), creates a new room, and place the creator into it
    // payload is an object of { playerName, worldType }
    socket.on("room:create", (payload = {}, callback) => {
        try {
            // if the socket is already in some old room, remove it from that old room first, and notify that old room that the player left
            const departureObj = leaveRoom(socket.id);
            emitDeparture(io, socket, departureObj);

            // create a brand new room
            const createdRoomObj = createRoom({
                socketId: socket.id,
                playerName: payload.playerName,
                worldType: payload.worldType,
            });

            // join the socket to the new room
            socket.join(createdRoomObj.room.id);

            const response = {
                ok: true,
                selfPlayerId: socket.id,
                room: createdRoomObj.room, // room object
            };

            console.log(`${socket.id} created a room. response:`);
            console.log(response);

            acknowledge(callback, response);

        } catch (error) {
            emitRoomError(socket, callback, error);
        }
    });

    // note that room:join is only for another user entering an existing room.
    // payload is an object of { roomId, playerName } 
    socket.on("room:join", (payload = {}, callback) => {
        try {
            const targetRoomId = String(payload.roomId ?? "").trim();
            if (!targetRoomId) {
                throw new Error("Room ID is required.");
            }

            // leave the room they were in before if they were in one
            const departureObj = leaveRoom(socket.id);
            emitDeparture(io, socket, departureObj);

            const joinedRoomObj = joinRoom({
                roomId: targetRoomId,
                socketId: socket.id,
                playerName: payload.playerName,
            });

            socket.join(joinedRoomObj.room.id);

            const response = {
                ok: true,
                selfPlayerId: socket.id,
                room: joinedRoomObj.room,
            };

            acknowledge(callback, response);

            if (joinedRoomObj.isNewPlayer) {
                // to let the existing people in the room know that someone joined in the chat
                // without this, only the joiner would receive the join system message
                if (joinedRoomObj.systemMessage) {
                    socket.to(joinedRoomObj.room.id).emit("chat:message", {
                        message: joinedRoomObj.systemMessage,
                    });
                }

                // note we use socket.to(room) instead of io.to(room) because the client socket that triggered this event already received the ack
                socket.to(joinedRoomObj.room.id).emit("player:joined", {
                    player: joinedRoomObj.player,
                });
            }

            console.log(`${joinedRoomObj.player.name} (${socket.id}) joined room ${joinedRoomObj.room.id}`)

        } catch (error) {
            emitRoomError(socket, callback, error);
        }
    });

    socket.on("room:leave", (_payload = {}, callback) => {
        const departureObj = leaveRoom(socket.id);
        emitDeparture(io, socket, departureObj);
        acknowledge(callback, { ok: true, roomId: departureObj?.roomId ?? null });
    });

    // return the state of the room, which contains all the players
    // use this from the client in cases where: client refreshes local UI state and wants to resync from server, reconnect happeened, 
    // client suspects it missed some events, or if we want to add a "refresh room state" action
    // In short, this is not needed often right now
    socket.on("room:state", (_payload = {}, callback) => {
        const roomId = getRoomIdBySocket(socket.id);
        const room = roomId ? getRoomSnapshot(roomId) : null;
        acknowledge(callback, { ok: Boolean(room), room });
    });

    // the payload is an object consisting of the latest player state (just position, rotation, and activeMessage )
    socket.on("player:update", (payload = {}, callback) => {
        try {
            const result = updatePlayerState(socket.id, payload);
            socket.to(result.roomId).emit("player:state", { // let the rest of the sockets in the room know that theres a new player update
                player: result.player,
            });
            acknowledge(callback, { ok: true });
            
        } catch (error) {
            emitRoomError(socket, callback, error);
        }
    });

    socket.on("object:update", (payload = {}, callback) => {
        try {
            const result = updateWorldObjectState(socket.id, payload);
            socket.to(result.roomId).emit("object:state", {
                object: result.object,
            });
            acknowledge(callback, { ok: true });
        } catch (error) {
            emitRoomError(socket, callback, error);
        }
    });

    // payload consists of an object with a text property describing the message text
    socket.on("chat:send", (payload = {}, callback) => {
        try {
            const result = addChatMessage(socket.id, payload.text);

            // emit to the whole room because the sender also needs the server-authoritative result
            // the sender's own avatar bubble should also update from the same server result
            // server accepts chat --> server creates canonical message --> server broadcasts canonical state
            io.to(result.roomId).emit("chat:message", {
                message: result.message,
            });

            // emit the new state of the player, which includes their chat bubble
            io.to(result.roomId).emit("player:state", {
                player: result.player,
            });

            // redundant if client is happy to treat receipt of chat:message emit above as the success signal
            // but I think we should keep it because its explicit success/failure handling
            acknowledge(callback, { ok: true, message: result.message });

        } catch (error) {
            emitRoomError(socket, callback, error);
        }
    });

    // valid commands: 
    // queue:add, queue:remove, queue:set-index, queue:clear
    // playback:play, playback:pause, playback:seek, playback:rate
    socket.on("watch:command", (payload = {}, callback) => {
        try {
            console.log(`watch:command event received from ${socket.id}. Command: ${payload.type}`)
            console.log("payload:", payload)
            const result = applyWatchTogetherCommand(socket.id, payload);

            // emit to the whole room so all clients, including sender, reconcile to server-authoritative watch state
            io.to(result.roomId).emit("watch:state", {
                watchTogether: result.watchTogether,
            });

            // this ack shouldn't be used. Use handler for watch:state instead client side
            acknowledge(callback, {
                ok: true,
                watchTogether: result.watchTogether,
            });
            
        } catch (error) {
            emitRoomError(socket, callback, error);
        }
    });

    socket.on("disconnect", () => {
        const departureObj = leaveRoom(socket.id);
        emitDeparture(io, socket, departureObj);

        console.log(`${socket.id} disconnected`)
    });
};
