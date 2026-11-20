import assert from "node:assert/strict";
import test from "node:test";
import { adminTransactionsQuerySchema, checkoutSchema, transactionListQuerySchema } from "../src/modules/transactions/transaction.validation";

test("checkout accepts only an appointment id", () => {
  assert.equal(checkoutSchema.safeParse({ appointmentId: "507f1f77bcf86cd799439011" }).success, true);
  assert.equal(checkoutSchema.safeParse({ appointmentId: "bad" }).success, false);
  assert.equal(checkoutSchema.safeParse({ appointmentId: "507f1f77bcf86cd799439011", amount: 1 }).success, false);
});

test("customer transaction pagination has safe defaults and limits", () => {
  assert.deepEqual(transactionListQuerySchema.parse({}), { page: 1, limit: 25 });
  assert.deepEqual(transactionListQuerySchema.parse({ page: "2", limit: "50" }), { page: 2, limit: 50 });
  assert.equal(transactionListQuerySchema.safeParse({ page: "0" }).success, false);
  assert.equal(transactionListQuerySchema.safeParse({ limit: "51" }).success, false);
});

test("admin transaction filters validate status, sorting and a bounded calendar range", () => {
  assert.deepEqual(adminTransactionsQuerySchema.parse({ search: "  Faruk ", status: "paid", dateFrom: "2026-11-01", dateTo: "2026-11-20", sort: "oldest", page: "2", limit: "50" }), {
    search: "Faruk", status: "paid", dateFrom: "2026-11-01", dateTo: "2026-11-20", sort: "oldest", page: 2, limit: 50,
  });
  assert.equal(adminTransactionsQuerySchema.safeParse({ status: "processing" }).success, false);
  assert.equal(adminTransactionsQuerySchema.safeParse({ dateFrom: "2026-02-30" }).success, false);
  assert.equal(adminTransactionsQuerySchema.safeParse({ dateFrom: "2026-11-20", dateTo: "2026-11-01" }).success, false);
  assert.equal(adminTransactionsQuerySchema.safeParse({ extra: "ignored" }).success, false);
});
