/**
 * Express app: handles normal HTTP routes like / and /health
 * Socket.IO server: handles websocket / polling connections for realtime events
 * Node HTTP server: the shared transport server both sit on top of
 */

import http from "node:http";

import cors from "cors";
import express from "express";
import morgan from "morgan";
import { Server } from "socket.io";

import { registerSocketHandlers } from "./socket/handlers.js";
import { roomExists } from "./world/rooms.js";

// note render sets an environment variable named PORT for our web service at runtime
const PORT = Number(process.env.PORT ?? 3001);
const SHUTDOWN_GRACE_PERIOD_MS = Number(process.env.SHUTDOWN_GRACE_PERIOD_MS ?? 10000);
let isShuttingDown = false;
const normalizeOrigin = (value) => {
    try {
        // this removes vrittle mismatches like trailing slashes or similar URL formatting differences
        return new URL(String(value ?? "").trim()).origin;
    } catch {
        return null;
    }
};

const CLIENT_ORIGINS = Array.from(new Set(
    (process.env.CLIENT_ORIGINS ?? "http://localhost:5173")
        .split(",")
        .map((origin) => normalizeOrigin(origin))
        .filter(Boolean),
));

const isAllowedOrigin = (origin) => {
    // curl or Postman is a case where origin is empty/missing
    if (!origin) {
        return true;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin) {
        return false;
    }

    return CLIENT_ORIGINS.includes(normalizedOrigin);
};

const app = express();
const httpServer = http.createServer(app); // actual node http server that serves the express app

app.use(morgan("common"));
app.use(express.json());
app.use(cors({
    origin(origin, callback) { // callback(error, allow) is the function you call to tell the CORS middleware whether to allow the request
        if (isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
}));

app.get("/health", (_request, response) => {
    if (isShuttingDown) {
        response.status(503).json({
            ok: false,
            service: "shiba-world-server",
            shuttingDown: true,
        });
        return;
    }

    response.json({
        ok: true,
        service: "shiba-world-server",
    });
});

app.get("/api/rooms/:roomId/exists", (request, response) => {
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

    response.json({
        ok: true,
        exists: roomExists(roomId),
        roomId,
    });
});

app.get("/", (_request, response) => {
    response.json({
        ok: true,
        message: "Socket.IO server is running.",
        health: "/health", // to advertise the health-check endpoint
    });
});

// attach Socket.IO to the same httpServer that express uses
// socket.io needs its own CORS config because express and Socket.IO are seaprate libraries that each handle incoming requests differently
// without it, express routes may owrk fine while the realtime connection still gets blocked
// the Socket.IO server is located on ws://localhost:3001
const io = new Server(httpServer, {
    cors: { 
        origin(origin, callback) {
            if (isAllowedOrigin(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error(`Origin ${origin} is not allowed by Socket.IO CORS.`));
        },
        credentials: true,
    },
});

// in current setup, each connected client gets its own socket connection and its own socket.id
io.on("connection", (socket) => {
    // socket object represnts one connect client, whereas io represents the whole Socket.IO server
    registerSocketHandlers(io, socket);
});

httpServer.listen(PORT, () => {
    console.log(`Shiba World server listening on http://localhost:${PORT}`);
});

const gracefulShutdown = (signal) => {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;

    console.log(`Received ${signal}. Starting graceful shutdown...`);

    const forceExitTimeout = setTimeout(() => {
        console.error(`Graceful shutdown timed out after ${SHUTDOWN_GRACE_PERIOD_MS}ms. Forcing exit.`);
        process.exit(1);
    }, SHUTDOWN_GRACE_PERIOD_MS);
    // If there is no other activity keeping the event loop running, the process may exit before the Timeout object's callback is invoked
    forceExitTimeout.unref?.();

    io.close(() => {
        console.log("Socket.IO server closed.");
    });

    httpServer.close((error) => {
        clearTimeout(forceExitTimeout);

        if (error) {
            console.error("HTTP server close failed:", error);
            process.exit(1); // exit code 1 (non-zero) = failure/error
            return;
        }

        console.log("HTTP server closed. Shutdown complete.");
        process.exit(0);
    });
};

// handle unix signals that ask process to stop
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // polite termination request from another process/platform
process.on("SIGINT", () => gracefulShutdown("SIGINT")); // interrupt from user input, usually Ctrl+C
