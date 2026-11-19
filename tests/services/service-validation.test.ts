import assert from "node:assert/strict";
import test from "node:test";
import { browseServicesQuerySchema } from "../../src/modules/services/service.validation";

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
