import { Router } from "express";
import { authenticate, requireCustomer } from "../../middleware/authenticate";
import { availability, cancelMine, create, details, mine, myAppointmentDetails, myAppointments, myStats } from "./appointment.controller";

export const appointmentRouter = Router();
appointmentRouter.use(authenticate);
appointmentRouter.get("/availability", requireCustomer, availability);
appointmentRouter.get("/my-stats", requireCustomer, myStats);
appointmentRouter.get("/my-appointments", requireCustomer, myAppointments);
appointmentRouter.get("/my-appointments/:id", requireCustomer, myAppointmentDetails);
appointmentRouter.post("/", requireCustomer, create);
appointmentRouter.get("/", requireCustomer, mine);
appointmentRouter.patch("/:id/cancel", requireCustomer, cancelMine);
appointmentRouter.get("/:id", details);
