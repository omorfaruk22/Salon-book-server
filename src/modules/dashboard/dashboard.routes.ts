import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { summary } from "./dashboard.controller";

export const dashboardRouter = Router();
dashboardRouter.get("/summary", authenticate, summary);
