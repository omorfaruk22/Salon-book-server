import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/authenticate";
import { getMe, listCustomers, setCustomerStatus, updateMe } from "./user.controller";

export const userRouter = Router();
userRouter.use(authenticate);
userRouter.get("/me", getMe);
userRouter.patch("/me", requireRole("customer"), updateMe);
userRouter.get("/", requireRole("admin"), listCustomers);
userRouter.patch("/:id/status", requireRole("admin"), setCustomerStatus);
