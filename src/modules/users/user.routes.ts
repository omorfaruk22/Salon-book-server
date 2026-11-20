import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/authenticate";
import { getMe, updateMe } from "./user.controller";

export const userRouter = Router();
userRouter.use(authenticate);
userRouter.get("/me", getMe);
userRouter.patch("/me", requireRole("customer"), updateMe);
