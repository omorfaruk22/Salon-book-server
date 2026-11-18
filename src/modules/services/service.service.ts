import { FilterQuery } from "mongoose";
import { Service, ServiceRecord } from "./service.model";
import { CreateServiceInput } from "./service.validation";

function makeSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function browseServices(query: { q?: string; category?: string; sort?: string; page: number; limit: number }) {
  const filter: FilterQuery<ServiceRecord> = { isActive: true };
  if (query.category) filter.category = query.category.toLowerCase();
  if (query.q) {
    const safeSearch = query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: safeSearch, $options: "i" } },
      { description: { $regex: safeSearch, $options: "i" } },
      { category: { $regex: safeSearch, $options: "i" } },
    ];
  }
  const sort: Record<string, 1 | -1> = query.sort === "price_asc" ? { price: 1, name: 1 } : query.sort === "price_desc" ? { price: -1, name: 1 } : { name: 1 };
  const [services, total, categoryDocs] = await Promise.all([
    Service.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Service.countDocuments(filter),
    Service.distinct("category", { isActive: true }),
  ]);
  return { services, total, categories: categoryDocs.sort() };
}

export async function getActiveService(slug: string) {
  return Service.findOne({ slug, isActive: true }).lean();
}

export async function listAllServices() {
  return Service.find().sort({ createdAt: -1 }).lean();
}

export async function createService(input: CreateServiceInput) {
  const slug = makeSlug(input.name);
  if (!slug) throw Object.assign(new Error("Service name must contain letters or numbers"), { status: 400 });
  return Service.create({ ...input, slug, category: input.category.trim().toLowerCase(), imageUrl: input.imageUrl || undefined, isActive: true });
}

export async function updateService(id: string, input: Partial<CreateServiceInput>) {
  const values = { ...input };
  if (values.name) {
    values.name = values.name.trim();
    const slug = makeSlug(values.name);
    if (!slug) throw Object.assign(new Error("Service name must contain letters or numbers"), { status: 400 });
    (values as Partial<CreateServiceInput> & { slug?: string }).slug = slug;
  }
  if (values.category) values.category = values.category.trim().toLowerCase();
  if (values.imageUrl === "") values.imageUrl = undefined;
  const service = await Service.findByIdAndUpdate(id, { $set: values }, { new: true, runValidators: true }).lean();
  return service;
}

export async function setServiceStatus(id: string, isActive: boolean) {
  return Service.findByIdAndUpdate(id, { $set: { isActive } }, { new: true, runValidators: true }).lean();
}

export async function deleteService(id: string) {
  return Service.findByIdAndDelete(id).lean();
}
