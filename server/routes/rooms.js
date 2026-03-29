import express from "express";
import { checkRoomExists } from "../controllers/rooms.js";

const router = express.Router();

router.get("/:roomId/exists", checkRoomExists)

export default router