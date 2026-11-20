import { Router } from "express";
import { authenticate, requireCustomer } from "../../middleware/authenticate";
import { createRateLimiter, authenticatedIdentity } from "../../middleware/rate-limit";
import { availability, cancelMine, create, details, mine, myAppointmentDetails, myAppointments, myStats } from "./appointment.controller";

export const appointmentRouter = Router();
const appointmentCreateLimit = createRateLimiter({ windowMs: 10 * 60_000, maxRequests: 8, keyGenerator: (req) => `appointment:${authenticatedIdentity(req)}`, message: "Too many booking requests. Please wait a few minutes and try again." });
appointmentRouter.use(authenticate);
appointmentRouter.get("/availability", requireCustomer, availability);
appointmentRouter.get("/my-stats", requireCustomer, myStats);
appointmentRouter.get("/my-appointments", requireCustomer, myAppointments);
appointmentRouter.get("/my-appointments/:id", requireCustomer, myAppointmentDetails);
appointmentRouter.post("/", requireCustomer, appointmentCreateLimit, create);
appointmentRouter.get("/", requireCustomer, mine);
appointmentRouter.patch("/:id/cancel", requireCustomer, cancelMine);
appointmentRouter.get("/:id", details);
