import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { browseServices, createService, deleteService, getActiveService, listAllServices, setServiceStatus, updateService } from "./service.service";
import { createServiceSchema, serviceStatusSchema, updateServiceSchema } from "./service.validation";

function badRequest(res: Response, message: string) {
  return res.status(400).json({ data: null, error: { message } });
}

export async function browse(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(48, Math.max(1, Number.parseInt(String(req.query.limit ?? "12"), 10) || 12));
    const sort = ["price_asc", "price_desc"].includes(String(req.query.sort)) ? String(req.query.sort) : "name";
    const result = await browseServices({ q: String(req.query.q ?? "").trim().slice(0, 100), category: String(req.query.category ?? "").trim().slice(0, 60), sort, page, limit });
    res.json({ data: result.services, error: null, meta: { page, limit, total: result.total, categories: result.categories } });
  } catch (error) { next(error); }
}

export async function details(req: Request, res: Response, next: NextFunction) {
  try {
    const service = await getActiveService(String(req.params.slug));
    if (!service) return res.status(404).json({ data: null, error: { message: "Service not found" } });
    return res.json({ data: service, error: null });
  } catch (error) { next(error); }
}

export async function adminList(_req: Request, res: Response, next: NextFunction) {
  try { res.json({ data: await listAllServices(), error: null }); } catch (error) { next(error); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  const parsed = createServiceSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  try { return res.status(201).json({ data: await createService(parsed.data), error: null }); } catch (error) { next(error); }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) return badRequest(res, "Invalid service id");
  const parsed = updateServiceSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.issues.map((issue) => issue.message).join("; "));
  try {
    const service = await updateService(id, parsed.data);
    if (!service) return res.status(404).json({ data: null, error: { message: "Service not found" } });
    return res.json({ data: service, error: null });
  } catch (error) { next(error); }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) return badRequest(res, "Invalid service id");
  const parsed = serviceStatusSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, "isActive must be true or false");
  try {
    const service = await setServiceStatus(id, parsed.data.isActive);
    if (!service) return res.status(404).json({ data: null, error: { message: "Service not found" } });
    return res.json({ data: service, error: null });
  } catch (error) { next(error); }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isValidObjectId(id)) return badRequest(res, "Invalid service id");
  try {
    const service = await deleteService(id);
    if (!service) return res.status(404).json({ data: null, error: { message: "Service not found" } });
    return res.json({ data: service, error: null });
  } catch (error) { next(error); }
}
