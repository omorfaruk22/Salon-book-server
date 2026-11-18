import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/authenticate";
import { uploadImage } from "./upload.controller";

export const uploadRouter = Router();
uploadRouter.post("/image", authenticate, requireRole("admin"), uploadImage);
