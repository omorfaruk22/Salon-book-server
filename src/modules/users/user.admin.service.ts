import { Types, type FilterQuery } from "mongoose";
import { Appointment } from "../appointments/appointment.model";
import { User, type UserRecord } from "./user.model";
import type { AdminCustomersQuery } from "./admin-user.validation";

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function safeCustomer(user: {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  imageUrl?: string;
  status: "active" | "blocked";
  createdAt: Date;
}) {
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    imageUrl: user.imageUrl ?? "",
    status: user.status,
    createdAt: user.createdAt,
  };
}

export async function listAdminCustomers(query: AdminCustomersQuery) {
  const filter: FilterQuery<UserRecord> = { role: "customer" };
  if (query.status !== "all") filter.status = query.status;
  if (query.search) {
    const escaped = query.search.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
    filter.$or = [
      { name: { $regex: escaped, $options: "i" } },
      { email: { $regex: escaped, $options: "i" } },
    ];
  }
  const sort: Record<string, 1 | -1> = query.sort === "oldest" ? { createdAt: 1, _id: 1 }
    : query.sort === "name-asc" ? { name: 1, _id: 1 }
      : query.sort === "name-desc" ? { name: -1, _id: -1 }
        : { createdAt: -1, _id: -1 };
  const [users, total, totalCustomers, activeCustomers, blockedCustomers] = await Promise.all([
    User.find(filter).select("_id name email phone imageUrl status createdAt").sort(sort)
      .skip((query.page - 1) * query.limit).limit(query.limit).lean().exec(),
    User.countDocuments(filter).exec(),
    User.countDocuments({ role: "customer" }).exec(),
    User.countDocuments({ role: "customer", status: "active" }).exec(),
    User.countDocuments({ role: "customer", status: "blocked" }).exec(),
  ]);
  return {
    customers: users.map((user) => safeCustomer(user as typeof users[number] & { _id: Types.ObjectId })),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
    stats: { totalCustomers, activeCustomers, blockedCustomers },
  };
}

export async function getAdminCustomer(id: string) {
  const user = await User.findOne({ _id: id, role: "customer" })
    .select("_id name email phone imageUrl status createdAt authUserId").lean().exec();
  if (!user) return null;
  const [stats] = await Appointment.aggregate<{
    totalAppointments: number;
    pendingAppointments: number;
    confirmedAppointments: number;
    cancelledAppointments: number;
  }>([
    { $match: { customerId: user.authUserId } },
    { $group: {
      _id: null,
      totalAppointments: { $sum: 1 },
      pendingAppointments: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
      confirmedAppointments: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
      cancelledAppointments: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
    } },
    { $project: { _id: 0, totalAppointments: 1, pendingAppointments: 1, confirmedAppointments: 1, cancelledAppointments: 1 } },
  ]).exec();
  const { authUserId: _authUserId, ...customer } = user;
  return {
    customer: safeCustomer(customer as typeof customer & { _id: Types.ObjectId }),
    appointments: stats ?? { totalAppointments: 0, pendingAppointments: 0, confirmedAppointments: 0, cancelledAppointments: 0 },
  };
}

export async function setAdminCustomerBlocked(id: string, adminProfileId: string, blocked: boolean) {
  if (id === adminProfileId) throw httpError(403, "You cannot block or unblock your own administrator account.");
  const target = await User.findById(id).select("_id role status").lean().exec();
  if (!target) throw httpError(404, "Customer not found");
  if (target.role !== "customer") throw httpError(403, "This action is only available for customer accounts.");
  const expectedStatus = blocked ? "active" : "blocked";
  const nextStatus = blocked ? "blocked" : "active";
  if (target.status !== expectedStatus) {
    throw httpError(409, blocked ? "This customer is already blocked." : "This customer is already active.");
  }
  const updated = await User.findOneAndUpdate(
    { _id: id, role: "customer", status: expectedStatus },
    { $set: { status: nextStatus } },
    { new: true, runValidators: true },
  ).select("_id name email phone imageUrl status createdAt").lean().exec();
  if (!updated) throw httpError(409, "Customer status changed. Refresh the list and try again.");
  return safeCustomer(updated as typeof updated & { _id: Types.ObjectId });
}
