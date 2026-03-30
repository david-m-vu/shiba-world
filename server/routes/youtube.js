import express from "express";
import { getVideoById, searchList } from "../controllers/youtube.js";

const router = express.Router();

router.get("/search", searchList)
router.get("/video", getVideoById)

export default router
