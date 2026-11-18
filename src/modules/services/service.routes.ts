import { Router } from "express";
import { authenticate, requireRole } from "../../middleware/authenticate";
import { adminList, browse, create, details, remove, update, updateStatus } from "./service.controller";

export const serviceRouter = Router();
serviceRouter.get("/", browse);
serviceRouter.get("/admin", authenticate, requireRole("admin"), adminList);
serviceRouter.get("/:slug", details);
serviceRouter.post("/", authenticate, requireRole("admin"), create);
serviceRouter.patch("/:id/status", authenticate, requireRole("admin"), updateStatus);
serviceRouter.patch("/:id", authenticate, requireRole("admin"), update);
serviceRouter.delete("/:id", authenticate, requireRole("admin"), remove);
