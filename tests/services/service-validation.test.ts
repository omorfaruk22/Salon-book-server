import assert from "node:assert/strict";
import test from "node:test";
import { browseServicesQuerySchema, isMongoObjectId } from "../../src/modules/services/service.validation";

test("accepts only 24-character hexadecimal MongoDB ObjectIds", () => {
  assert.equal(isMongoObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isMongoObjectId("507F1F77BCF86CD799439011"), true);
  assert.equal(isMongoObjectId("507f1f77bcf86cd79943901"), false);
  assert.equal(isMongoObjectId("507f1f77bcf86cd79943901z"), false);
  assert.equal(isMongoObjectId("abcdefghijkl"), false);
});

test("uses safe default browsing options", () => {
  const result = browseServicesQuerySchema.parse({});
  assert.deepEqual(result, { search: undefined, category: undefined, sort: "default", page: 1, limit: 12 });
});

test("trims search and normalizes category and price sorting", () => {
  const result = browseServicesQuerySchema.parse({ search: "  Hair Cut  ", category: " FACE ", sort: "price-asc", page: "2", limit: "24" });
  assert.deepEqual(result, { search: "Hair Cut", category: "face", sort: "price-asc", page: 2, limit: 24 });
});

test("keeps the previous q and underscore sort aliases working", () => {
  const result = browseServicesQuerySchema.parse({ q: " haircut ", sort: "price_desc" });
  assert.equal(result.search, "haircut");
  assert.equal(result.sort, "price-desc");
});

test("rejects unsafe or malformed browse parameters", () => {
  for (const input of [
    { sort: "price.$where" },
    { page: "0" },
    { page: "2.5" },
    { limit: "49" },
    { limit: "-1" },
    { search: "a".repeat(101) },
    { search: "hair", q: "cut" },
    { price: "1" },
  ]) {
    assert.equal(browseServicesQuerySchema.safeParse(input).success, false, JSON.stringify(input));
  }
});
