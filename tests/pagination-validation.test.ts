import assert from "node:assert/strict";
import test from "node:test";
import { myAppointmentsQuerySchema, adminAppointmentsQuerySchema } from "../src/modules/appointments/appointment.validation";
import { adminCustomersQuerySchema } from "../src/modules/users/admin-user.validation";
import { adminServicesQuerySchema, browseServicesQuerySchema } from "../src/modules/services/service.validation";
import { adminTransactionsQuerySchema, transactionListQuerySchema } from "../src/modules/transactions/transaction.validation";

test("pagination accepts bounded decimal integers and rejects coercion tricks or excessive pages", () => {
  const schemas = [
    myAppointmentsQuerySchema,
    adminAppointmentsQuerySchema,
    adminCustomersQuerySchema,
    adminServicesQuerySchema,
    browseServicesQuerySchema,
    transactionListQuerySchema,
    adminTransactionsQuerySchema,
  ];
  for (const schema of schemas) {
    assert.equal(schema.safeParse({ page: "2" }).success, true);
    for (const page of ["1e3", " 2", "2.5", "-1", "10001", ["2", "3"]]) {
      assert.equal(schema.safeParse({ page }).success, false, `Accepted page value ${JSON.stringify(page)}`);
    }
  }
});
