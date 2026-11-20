import type { NextFunction, Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { browseServices, createService, deleteService, getActiveServiceById, getServiceById, listAllServices, setServiceStatus, updateService } from "./service.service";
import { adminServicesQuerySchema, browseServicesQuerySchema, createServiceSchema, isMongoObjectId, serviceStatusSchema, updateServiceSchema } from "./service.validation";

function badRequest(res: Response, message: string) {
  return res.status(400).json({ data: null, error: { message } });
}

export async function browse(req: Request, res: Response, next: NextFunction) {
  const parsed = browseServicesQuerySchema.safeParse(req.query);
  if (!parsed.success) return badRequest(res, "Invalid services query parameters. Use a search up to 100 characters, a category up to 60 characters, sort=default|price-asc|price-desc, page of at least 1, and limit from 1 to 48.");
  try {
    const result = await browseServices(parsed.data);
    res.json({ data: result.services, error: null, meta: {
      page: parsed.data.page,
      limit: parsed.data.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / parsed.data.limit),
      activeTotal: result.activeTotal,
      categories: result.categories,
    } });
  } catch (error) { next(error); }
}

export async function details(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isMongoObjectId(id)) return badRequest(res, "Invalid service id");
  try {
    const service = await getActiveServiceById(id);
    if (!service) return res.status(404).json({ data: null, error: { message: "Service not found" } });
    return res.json({ data: service, error: null });
  } catch (error) { next(error); }
}

export async function adminList(req: Request, res: Response, next: NextFunction) {
  const parsed = adminServicesQuerySchema.safeParse(req.query);
  if (!parsed.success) return badRequest(res, "Invalid admin service filters. Check search, category, status, sort, page, and limit.");
  try {
    const result = await listAllServices(parsed.data);
    return res.json({ data: result.services, error: null, meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      totalServices: result.totalServices,
      activeServices: result.activeServices,
      inactiveServices: result.inactiveServices,
      categories: result.categories,
    } });
  } catch (error) { return next(error); }
}

export async function adminDetails(req: Request, res: Response, next: NextFunction) {
  const id = String(req.params.id);
  if (!isMongoObjectId(id)) return badRequest(res, "Invalid service id");
  try {
    const service = await getServiceById(id);
    if (!service) return res.status(404).json({ data: null, error: { message: "Service not found" } });
    return res.json({ data: service, error: null });
  } catch (error) { return next(error); }
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
