import express from "express";
import { searchList } from "../controllers/youtube.js";

const router = express.Router();

router.get("/search", searchList)

export default router