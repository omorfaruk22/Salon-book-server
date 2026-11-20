import { FilterQuery } from "mongoose";
import { Appointment } from "../appointments/appointment.model";
import { Service, ServiceRecord } from "./service.model";
import { AdminServicesQuery, BrowseServicesQuery, CreateServiceInput, UpdateServiceInput } from "./service.validation";

function makeSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function browseServices(query: BrowseServicesQuery) {
  const filter: FilterQuery<ServiceRecord> = { isActive: true };
  if (query.category) filter.category = query.category;
  if (query.search) {
    const safeSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = { $regex: safeSearch, $options: "i" };
  }
  const sort: Record<string, 1 | -1> = query.sort === "price-asc"
    ? { price: 1, name: 1, _id: 1 }
    : query.sort === "price-desc"
      ? { price: -1, name: -1, _id: -1 }
      : { name: 1, _id: 1 };
  const [services, total, activeTotal, categoryDocs] = await Promise.all([
    Service.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Service.countDocuments(filter),
    Service.countDocuments({ isActive: true }),
    Service.distinct("category", { isActive: true }),
  ]);
  return { services, total, activeTotal, categories: categoryDocs.sort() };
}

export async function getActiveServiceById(id: string) {
  return Service.findOne({ _id: id, isActive: true }).lean();
}

export async function listAllServices(query: AdminServicesQuery) {
  const filter: FilterQuery<ServiceRecord> = {};
  if (query.category) filter.category = query.category;
  if (query.status === "active") filter.isActive = true;
  if (query.status === "inactive") filter.isActive = false;
  if (query.search) {
    const safeSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = { $regex: safeSearch, $options: "i" };
  }

  const sort: Record<string, 1 | -1> = query.sort === "oldest" ? { createdAt: 1, _id: 1 }
    : query.sort === "price-asc" ? { price: 1, name: 1, _id: 1 }
      : query.sort === "price-desc" ? { price: -1, name: -1, _id: -1 }
        : { createdAt: -1, _id: -1 };

  const [services, total, totalServices, activeServices, categories] = await Promise.all([
    Service.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(),
    Service.countDocuments(filter).exec(),
    Service.countDocuments({}).exec(),
    Service.countDocuments({ isActive: true }).exec(),
    Service.distinct("category").exec(),
  ]);
  return {
    services,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
    totalServices,
    activeServices,
    inactiveServices: totalServices - activeServices,
    categories: categories.sort(),
  };
}

export async function getServiceById(id: string) {
  return Service.findById(id).lean().exec();
}

export async function createService(input: CreateServiceInput) {
  const slug = makeSlug(input.name);
  if (!slug) throw Object.assign(new Error("Service name must contain letters or numbers"), { status: 400 });
  return Service.create({ ...input, slug, category: input.category.trim().toLowerCase(), isActive: input.isActive ?? true });
}

export async function updateService(id: string, input: UpdateServiceInput) {
  const values = { ...input };
  if (values.name) {
    values.name = values.name.trim();
    const slug = makeSlug(values.name);
    if (!slug) throw Object.assign(new Error("Service name must contain letters or numbers"), { status: 400 });
    (values as Partial<CreateServiceInput> & { slug?: string }).slug = slug;
  }
  if (values.category) values.category = values.category.trim().toLowerCase() as UpdateServiceInput["category"];
  const service = await Service.findByIdAndUpdate(id, { $set: values }, { new: true, runValidators: true }).lean();
  return service;
}

export async function setServiceStatus(id: string, isActive: boolean) {
  return Service.findByIdAndUpdate(id, { $set: { isActive } }, { new: true, runValidators: true }).lean();
}

export async function deleteService(id: string) {
  const hasAppointments = await Appointment.exists({ serviceId: id }).exec();
  if (hasAppointments) {
    throw Object.assign(new Error("This service has appointment history and cannot be permanently deleted. Deactivate it instead."), { status: 409 });
  }
  return Service.findByIdAndDelete(id).lean().exec();
}
