import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authenticate";
import { User } from "./user.model";
import { updateProfileSchema } from "./user.validation";

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = (req as AuthenticatedRequest).authUser!;
    const user = await User.findOne({ authUserId: authUser.id }).select("name email phone imageUrl role status createdAt").lean().exec();
    if (!user) return res.status(404).json({ data: null, error: { message: "Profile not found" } });
    return res.json({ data: user, error: null });
  } catch (error) { return next(error); }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: parsed.error.issues.map((issue) => issue.message).join("; ") } });
  try {
    const authUser = (req as AuthenticatedRequest).authUser!;
    const user = await User.findOneAndUpdate(
      { authUserId: authUser.id, status: "active", role: "customer" },
      { $set: parsed.data },
      { new: true, runValidators: true },
    ).select("name email phone imageUrl role status createdAt").lean().exec();
    if (!user) return res.status(404).json({ data: null, error: { message: "Profile not found" } });
    return res.json({ data: user, error: null });
  } catch (error) { return next(error); }
}
