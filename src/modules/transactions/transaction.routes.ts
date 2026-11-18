import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { checkout, details, list } from "./transaction.controller";

export const transactionRouter = Router();
transactionRouter.use(authenticate);
transactionRouter.post("/checkout-session", checkout);
transactionRouter.get("/", list);
transactionRouter.get("/:id", details);
