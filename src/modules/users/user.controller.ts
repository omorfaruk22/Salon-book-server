import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { AuthenticatedRequest } from "../../middleware/authenticate";
import { User } from "./user.model";
import { updateProfileSchema, userStatusSchema } from "./user.validation";

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = (req as AuthenticatedRequest).authUser!;
    const user = await User.findOne({ authUserId: authUser.id }).select("name email phone imageUrl role status createdAt").lean();
    if (!user) return res.status(404).json({ data: null, error: { message: "Profile not found" } });
    return res.json({ data: user, error: null });
  } catch (error) { next(error); }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: parsed.error.issues.map((issue) => issue.message).join("; ") } });
  try {
    const authUser = (req as AuthenticatedRequest).authUser!;
    const user = await User.findOneAndUpdate({ authUserId: authUser.id }, { $set: parsed.data }, { new: true, runValidators: true }).select("name email phone imageUrl role status createdAt").lean();
    if (!user) return res.status(404).json({ data: null, error: { message: "Profile not found" } });
    return res.json({ data: user, error: null });
  } catch (error) { next(error); }
}

export async function listCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "25"), 10) || 25));
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const status = typeof req.query.status === "string" && ["active", "blocked"].includes(req.query.status) ? req.query.status : undefined;
    const filter: Record<string, unknown> = { role: "customer" };
    if (status) filter.status = status;
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ name: { $regex: escaped, $options: "i" } }, { email: { $regex: escaped, $options: "i" } }, { phone: { $regex: escaped, $options: "i" } }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).select("name email phone status createdAt").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    return res.json({ data: users, error: null, meta: { page, limit, total } });
  } catch (error) { next(error); }
}

export async function setCustomerStatus(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) return res.status(400).json({ data: null, error: { message: "Invalid customer id" } });
  const parsed = userStatusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: "Status must be active or blocked" } });
  try {
    const user = await User.findOneAndUpdate({ _id: id, role: "customer" }, { $set: { status: parsed.data.status } }, { new: true }).select("name email phone status createdAt").lean();
    if (!user) return res.status(404).json({ data: null, error: { message: "Customer not found" } });
    return res.json({ data: user, error: null });
  } catch (error) { next(error); }
}
