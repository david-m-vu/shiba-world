/**
 * Express app: handles normal HTTP routes like / and /health
 * Socket.IO server: handles websocket / polling connections for realtime events
 * Node HTTP server: the shared transport server both sit on top of
 */

import http from "node:http";

import cors from "cors";
import express from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import { Server } from "socket.io";

import youtubeRoutes from "./routes/youtube.js";
import roomRoutes from "./routes/rooms.js";

import { registerSocketHandlers } from "./socket/handlers.js";
import { getRoomStore, setRoomStore } from "./world/room-store/index.js";
// import { createRedisRoomStore } from "./world/room-store/redisRoomStore.js";

dotenv.config();

// note render sets an environment variable named PORT for our web service at runtime
const PORT = Number(process.env.PORT ?? 3001);
const SHUTDOWN_GRACE_PERIOD_MS = Number(process.env.SHUTDOWN_GRACE_PERIOD_MS ?? 10000);
const ROOM_STORE_DRIVER = String(process.env.ROOM_STORE_DRIVER ?? "memory").trim().toLowerCase();
const REDIS_URL = String(process.env.REDIS_URL ?? "").trim();
const ROOM_STORE_KEY_PREFIX = String(process.env.ROOM_STORE_KEY_PREFIX ?? "shiba-world").trim() || "shiba-world";

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

app.use("/api/rooms", roomRoutes);
app.use("/api/youtube", youtubeRoutes);

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

const initializeRoomStore = async () => {
    if (ROOM_STORE_DRIVER === "memory") {
        console.log("RoomStore driver: memory");
        return;
    }

    if (ROOM_STORE_DRIVER !== "redis") {
        throw new Error(`Unsupported ROOM_STORE_DRIVER "${ROOM_STORE_DRIVER}". Use "memory" or "redis".`);
    }

    if (!REDIS_URL) {
        throw new Error("REDIS_URL is required when ROOM_STORE_DRIVER=redis.");
    }

    // const redisRoomStore = await createRedisRoomStore({
    //     redisUrl: REDIS_URL,
    //     keyPrefix: ROOM_STORE_KEY_PREFIX,
    // });

    // // store the object reference of the RedisRoomStore object in memory
    // setRoomStore(redisRoomStore);
    // console.log(`RoomStore driver: redis (${ROOM_STORE_KEY_PREFIX})`);
};

const startServer = async () => {
    await initializeRoomStore();

    httpServer.listen(PORT, () => {
        console.log(`Shiba World server listening on http://localhost:${PORT}`);
    });
};

startServer().catch((error) => {
    console.error("Server bootstrap failed:", error);
    process.exit(1);
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

    httpServer.close(async (error) => {
        clearTimeout(forceExitTimeout);

        if (error) {
            console.error("HTTP server close failed:", error);
            process.exit(1); // exit code 1 (non-zero) = failure/error
            return;
        }

        // before closing the http server, call close. Close in the redis driver closes the connection
        try {
            const roomStore = getRoomStore();
            if (typeof roomStore.close === "function") {
                await roomStore.close();
            }
            
        } catch (storeCloseError) {
            console.error("RoomStore close failed:", storeCloseError);
            process.exit(1);
            return;
        }

        console.log("HTTP server closed. Shutdown complete.");
        process.exit(0);
    });
};

// handle unix signals that ask process to stop
process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // polite termination request from another process/platform
process.on("SIGINT", () => gracefulShutdown("SIGINT")); // interrupt from user input, usually Ctrl+C
