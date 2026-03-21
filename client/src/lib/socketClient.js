import { io } from "socket.io-client";

const ACK_TIMEOUT_MS = 6000;

export const createGameSocket = () => {
    return io(import.meta.env.VITE_SERVER_URL, {
        autoConnect: false, // do not immediately open a network connection - connect manually - avoids idle connections on the landing screen
        withCredentials: true, // include credentials like cookies
    })
}

// this is a helper function to emit a given event from a socket with payload. 
// either gets rejected if it doesn't receive an ack from the server within ACK_TIMEOUT_MS
// or resolves to the callback response
export const emitWithAck = (socket, eventName, payload = {}, timeoutMs = ACK_TIMEOUT_MS) => {
    if (!socket) {
        return Promise.reject(new Error("Socket is not initialized."));
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
            // if this is true, promise already got fulfilled
            if (settled) {
                return;
            }
            settled = true;
            reject(new Error(`Timed out waiting for "${eventName}" acknowledgement`));
        }, timeoutMs);

        socket.emit(eventName, payload, (response) => {
            // if this is true, promise already got rejected
            if (settled) {
                return;
            }

            settled = true;
            window.clearTimeout(timeoutId);
            resolve(response ?? {});
        })
    })
}