import { Router } from "express";
import { authenticate, requireCustomer } from "../../middleware/authenticate";
import { createRateLimiter, authenticatedIdentity } from "../../middleware/rate-limit";
import { checkout, details, list, verifyCheckout } from "./transaction.controller";

export const transactionRouter = Router();
const checkoutCreateLimit = createRateLimiter({ windowMs: 10 * 60_000, maxRequests: 8, keyGenerator: (req) => `checkout:${authenticatedIdentity(req)}`, message: "Too many checkout requests. Wait a few minutes and try again." });
transactionRouter.use(authenticate, requireCustomer);
transactionRouter.post("/checkout-session", checkoutCreateLimit, checkout);
transactionRouter.get("/verify/:sessionId", verifyCheckout);
transactionRouter.get("/", list);
transactionRouter.get("/:id", details);
