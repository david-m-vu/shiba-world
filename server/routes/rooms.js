import express from "express";
import { checkRoomExists, getRoomStatus } from "../controllers/rooms.js";

const router = express.Router();

router.get("/:roomId/status", getRoomStatus)
router.get("/:roomId/exists", checkRoomExists)

export default router
