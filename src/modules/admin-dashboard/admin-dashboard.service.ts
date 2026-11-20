import { Appointment } from "../appointments/appointment.model";
import { Service } from "../services/service.model";
import { Transaction } from "../transactions/transaction.model";
import { User } from "../users/user.model";

const appointmentStatuses = ["pending", "confirmed", "cancelled", "completed"] as const;

export async function getAdminDashboardStats() {
  const [totalCustomers, activeServices, appointmentStatusRows, paidRows] = await Promise.all([
    // Match the existing dashboard convention: all customer-role accounts count, including blocked accounts.
    User.countDocuments({ role: "customer" }).exec(),
    Service.countDocuments({ isActive: true }).exec(),
    Appointment.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).exec(),
    Transaction.aggregate<{ count: number; revenue: number }>([
      { $match: { status: "paid" } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$amount" } } },
    ]).exec(),
  ]);

  const appointmentCounts = new Map(appointmentStatusRows.map((row) => [row._id, row.count]));
  const successfulPayments = paidRows[0]?.count ?? 0;
  return {
    totalCustomers,
    activeServices,
    totalAppointments: appointmentStatusRows.reduce((total, row) => total + row.count, 0),
    pendingAppointments: appointmentCounts.get("pending") ?? 0,
    confirmedAppointments: appointmentCounts.get("confirmed") ?? 0,
    cancelledAppointments: appointmentCounts.get("cancelled") ?? 0,
    successfulPayments,
    ...(successfulPayments > 0 ? { totalRevenue: paidRows[0].revenue } : {}),
  };
}

export async function getRecentAdminAppointments(limit: number) {
  return Appointment.aggregate([
    { $sort: { createdAt: -1, _id: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: User.collection.name,
        localField: "customerId",
        foreignField: "authUserId",
        as: "customerProfile",
      },
    },
    { $unwind: { path: "$customerProfile", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: { $toString: "$_id" },
        customer: {
          name: { $ifNull: ["$customerProfile.name", "Customer"] },
          email: { $ifNull: ["$customerProfile.email", ""] },
        },
        serviceName: "$serviceSnapshot.name",
        servicePrice: "$serviceSnapshot.price",
        startsAt: 1,
        appointmentDate: 1,
        timeSlot: 1,
        status: 1,
        paymentStatus: 1,
        createdAt: 1,
      },
    },
  ]).exec();
}

export async function getRecentSuccessfulAdminTransactions(limit: number) {
  return Transaction.aggregate([
    { $match: { status: "paid" } },
    { $sort: { paidAt: -1, createdAt: -1, _id: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: User.collection.name,
        localField: "customerId",
        foreignField: "authUserId",
        as: "customerProfile",
      },
    },
    { $unwind: { path: "$customerProfile", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: { $toString: "$_id" },
        appointmentId: { $toString: "$appointmentId" },
        customer: {
          name: { $ifNull: ["$customerProfile.name", "Customer"] },
          email: { $ifNull: ["$customerProfile.email", ""] },
        },
        serviceName: 1,
        amount: 1,
        currency: 1,
        status: 1,
        paidAt: 1,
        createdAt: 1,
      },
    },
  ]).exec();
}

export async function getAdminAppointmentAnalytics(days: number) {
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  const [statusRows, dailyTrend] = await Promise.all([
    Appointment.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]).exec(),
    Appointment.aggregate<{
      _id: string;
      total: number;
      pending: number;
      confirmed: number;
      cancelled: number;
      completed: number;
    }>([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Dhaka" } },
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          confirmed: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec(),
  ]);

  const counts = new Map(statusRows.map((row) => [row._id, row.count]));
  return {
    statusDistribution: Object.fromEntries(appointmentStatuses.map((status) => [status, counts.get(status) ?? 0])),
    dailyTrend: dailyTrend.map(({ _id, ...countsForDay }) => ({ date: _id, ...countsForDay })),
    days,
    timeZone: "Asia/Dhaka",
  };
}
