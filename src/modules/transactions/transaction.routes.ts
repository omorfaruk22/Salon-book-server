import { Router } from "express";
import { authenticate, requireCustomer } from "../../middleware/authenticate";
import { checkout, details, list, verifyCheckout } from "./transaction.controller";

export const transactionRouter = Router();
transactionRouter.use(authenticate, requireCustomer);
transactionRouter.post("/checkout-session", checkout);
transactionRouter.get("/verify/:sessionId", verifyCheckout);
transactionRouter.get("/", list);
transactionRouter.get("/:id", details);
