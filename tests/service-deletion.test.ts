import assert from "node:assert/strict";
import test from "node:test";
import { Appointment } from "../src/modules/appointments/appointment.model";
import { deleteService } from "../src/modules/services/service.service";
import { Service } from "../src/modules/services/service.model";

function replaceStatic(target: object, key: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
  return () => {
    if (previous) Object.defineProperty(target, key, previous);
    else Reflect.deleteProperty(target, key);
  };
}

test("service with appointment history is protected from permanent deletion", async () => {
  let deleteCalled = false;
  const restoreExists = replaceStatic(Appointment, "exists", () => ({ exec: async () => ({ _id: "appointment" }) }));
  const restoreDelete = replaceStatic(Service, "findByIdAndDelete", () => {
    deleteCalled = true;
    return { lean: () => ({ exec: async () => ({ _id: "service" }) }) };
  });
  try {
    await assert.rejects(deleteService("507f1f77bcf86cd799439011"), (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409);
      assert.match((error as Error).message, /appointment history/);
      return true;
    });
    assert.equal(deleteCalled, false);
  } finally {
    restoreDelete();
    restoreExists();
  }
});

test("service without appointment history can be permanently deleted", async () => {
  const deleted = { _id: "507f1f77bcf86cd799439011" };
  const restoreExists = replaceStatic(Appointment, "exists", () => ({ exec: async () => null }));
  const restoreDelete = replaceStatic(Service, "findByIdAndDelete", () => ({ lean: () => ({ exec: async () => deleted }) }));
  try {
    assert.deepEqual(await deleteService(deleted._id), deleted);
  } finally {
    restoreDelete();
    restoreExists();
  }
});
