import { Router } from "express";
import { authenticate, requireAdmin } from "../../middleware/authenticate";
import { adminTransactionDetailsController, adminTransactionStatsController, listAdminTransactionsController } from "./transaction.admin.controller";

export const adminTransactionRouter = Router();
adminTransactionRouter.use(authenticate, requireAdmin);
adminTransactionRouter.get("/stats", adminTransactionStatsController);
adminTransactionRouter.get("/", listAdminTransactionsController);
adminTransactionRouter.get("/:id", adminTransactionDetailsController);
