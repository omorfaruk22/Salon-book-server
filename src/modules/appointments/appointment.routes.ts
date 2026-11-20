import { Router } from "express";
import { authenticate, requireAdmin, requireCustomer } from "../../middleware/authenticate";
import { all, availability, cancelMine, changeStatus, confirm, create, details, mine, myAppointmentDetails, myAppointments, myStats } from "./appointment.controller";

export const appointmentRouter = Router();
appointmentRouter.use(authenticate);
appointmentRouter.get("/availability", requireCustomer, availability);
appointmentRouter.get("/my-stats", requireCustomer, myStats);
appointmentRouter.get("/my-appointments", requireCustomer, myAppointments);
appointmentRouter.get("/my-appointments/:id", requireCustomer, myAppointmentDetails);
appointmentRouter.post("/", requireCustomer, create);
appointmentRouter.get("/", requireCustomer, mine);
appointmentRouter.get("/admin", requireAdmin, all);
appointmentRouter.patch("/:id/cancel", requireCustomer, cancelMine);
appointmentRouter.patch("/:id/confirm", requireAdmin, confirm);
appointmentRouter.patch("/:id/status", requireAdmin, changeStatus);
appointmentRouter.get("/:id", details);
