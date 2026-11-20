import { Router } from "express";
import { authenticate, requireAdmin } from "../../middleware/authenticate";
import {
  adminAppointmentDetailsController,
  cancelAdminAppointmentController,
  completeAdminAppointmentController,
  confirmAdminAppointmentController,
  listAdminAppointmentsController,
} from "./appointment.admin.controller";

export const adminAppointmentRouter = Router();
adminAppointmentRouter.use(authenticate, requireAdmin);
adminAppointmentRouter.get("/", listAdminAppointmentsController);
adminAppointmentRouter.get("/:id", adminAppointmentDetailsController);
adminAppointmentRouter.patch("/:id/confirm", confirmAdminAppointmentController);
adminAppointmentRouter.patch("/:id/cancel", cancelAdminAppointmentController);
adminAppointmentRouter.patch("/:id/complete", completeAdminAppointmentController);
