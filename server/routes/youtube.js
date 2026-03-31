import express from "express";
import { getPreset, getVideoById, searchList } from "../controllers/youtube.js";

const router = express.Router();

router.get("/search", searchList)
router.get("/video", getVideoById)
router.get("/preset", getPreset)

export default router
