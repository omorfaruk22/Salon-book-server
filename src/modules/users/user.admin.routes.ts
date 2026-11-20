import { Router } from "express";
import { authenticate, requireAdmin } from "../../middleware/authenticate";
import {
  adminCustomerDetailsController,
  blockAdminCustomerController,
  listAdminCustomersController,
  unblockAdminCustomerController,
} from "./user.admin.controller";

export const adminUserRouter = Router();
adminUserRouter.use(authenticate, requireAdmin);
adminUserRouter.get("/", listAdminCustomersController);
adminUserRouter.get("/:id", adminCustomerDetailsController);
adminUserRouter.patch("/:id/block", blockAdminCustomerController);
adminUserRouter.patch("/:id/unblock", unblockAdminCustomerController);
