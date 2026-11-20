import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authenticate";
import { adminCustomerActionSchema, adminCustomersQuerySchema } from "./admin-user.validation";
import { getAdminCustomer, listAdminCustomers, setAdminCustomerBlocked } from "./user.admin.service";

function badRequest(res: Response, message: string) {
  return res.status(400).json({ data: null, error: { message } });
}

function userError(error: unknown, res: Response, next: NextFunction) {
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 500;
  if (status >= 400 && status < 500) return res.status(status).json({ data: null, error: { message: error instanceof Error ? error.message : "Customer operation failed." } });
  return next(error);
}

export async function listAdminCustomersController(req: Request, res: Response, next: NextFunction) {
  const parsed = adminCustomersQuerySchema.safeParse(req.query);
  if (!parsed.success) return badRequest(res, "Invalid customer filters. Check search, status, sort, page, and limit.");
  try {
    const result = await listAdminCustomers(parsed.data);
    return res.json({
      data: result.customers,
      error: null,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        stats: result.stats,
      },
    });
  } catch (error) { return next(error); }
}

export async function adminCustomerDetailsController(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!/^[a-f\d]{24}$/i.test(id)) return badRequest(res, "Invalid customer id");
  try {
    const result = await getAdminCustomer(id);
    if (!result) return res.status(404).json({ data: null, error: { message: "Customer not found" } });
    return res.json({ data: result, error: null });
  } catch (error) { return next(error); }
}

export async function blockAdminCustomerController(req: Request, res: Response, next: NextFunction) {
  return changeAdminCustomerStatus(req, res, next, true);
}

export async function unblockAdminCustomerController(req: Request, res: Response, next: NextFunction) {
  return changeAdminCustomerStatus(req, res, next, false);
}

async function changeAdminCustomerStatus(req: Request, res: Response, next: NextFunction, blocked: boolean) {
  const id = String(req.params.id);
  if (!/^[a-f\d]{24}$/i.test(id)) return badRequest(res, "Invalid customer id");
  const parsed = adminCustomerActionSchema.safeParse(req.body ?? {});
  if (!parsed.success) return badRequest(res, "This action does not accept extra customer fields.");
  try {
    const adminId = (req as AuthenticatedRequest).authUser!.profileId;
    const customer = await setAdminCustomerBlocked(id, adminId, blocked);
    return res.json({ data: customer, error: null });
  } catch (error) { return userError(error, res, next); }
}
