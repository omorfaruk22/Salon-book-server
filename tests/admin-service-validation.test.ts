import assert from "node:assert/strict";
import test from "node:test";
import { adminServicesQuerySchema, createServiceSchema, updateServiceSchema } from "../src/modules/services/service.validation";
import { validateImageFile } from "../src/modules/uploads/image-upload.validation";

const validService = {
  name: "Signature Haircut",
  description: "A tailored haircut finished with a professional style.",
  category: "Hair",
  durationMinutes: 30,
  price: 500,
  imageUrl: "https://i.ibb.co/abc123/salon-service.png",
};

test("create service trims text, normalizes category, and defaults active status", () => {
  const parsed = createServiceSchema.parse({ ...validService, name: "  Signature Haircut  " });
  assert.equal(parsed.name, "Signature Haircut");
  assert.equal(parsed.category, "hair");
  assert.equal(parsed.isActive, true);
});

test("create service rejects blank text, unsupported categories, unsafe images, and invalid prices", () => {
  assert.equal(createServiceSchema.safeParse({ ...validService, name: "   " }).success, false);
  assert.equal(createServiceSchema.safeParse({ ...validService, category: "unknown category" }).success, false);
  assert.equal(createServiceSchema.safeParse({ ...validService, imageUrl: "https://example.com/image.png" }).success, false);
  assert.equal(createServiceSchema.safeParse({ ...validService, price: 0 }).success, false);
});

test("update service permits omitted image and rejects empty or unknown updates", () => {
  assert.deepEqual(updateServiceSchema.parse({ name: "Updated haircut" }), { name: "Updated haircut" });
  assert.equal(updateServiceSchema.safeParse({}).success, false);
  assert.equal(updateServiceSchema.safeParse({ role: "admin" }).success, false);
});

test("admin service query validates pagination and normalizes filters", () => {
  assert.deepEqual(adminServicesQuerySchema.parse({ search: " haircut ", category: "Hair", status: "active", sort: "price-asc", page: "2", limit: "10" }), {
    search: "haircut", category: "hair", status: "active", sort: "price-asc", page: 2, limit: 10,
  });
  assert.equal(adminServicesQuerySchema.safeParse({ page: "0" }).success, false);
  assert.equal(adminServicesQuerySchema.safeParse({ limit: "100" }).success, false);
  assert.equal(adminServicesQuerySchema.safeParse({ status: "deleted" }).success, false);
});

function fakeFile(mimetype: string, buffer: Buffer, size = buffer.length) {
  const extension = mimetype === "image/jpeg" ? "jpg" : mimetype === "image/png" ? "png" : mimetype === "image/webp" ? "webp" : "gif";
  return { fieldname: "image", originalname: `service.${extension}`, encoding: "7bit", mimetype, size, buffer } as Express.Multer.File;
}

test("image validation accepts supported matching file signatures", () => {
  assert.equal(validateImageFile(fakeFile("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00]))), null);
  assert.equal(validateImageFile(fakeFile("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))), null);
  const webp = Buffer.alloc(30);
  webp.write("RIFF", 0, "ascii");
  webp.writeUInt32LE(webp.length - 8, 4);
  webp.write("WEBP", 8, "ascii");
  assert.equal(validateImageFile(fakeFile("image/webp", webp)), null);
});

test("image validation rejects absent, oversized, unsupported, and spoofed files", () => {
  assert.match(validateImageFile(undefined) ?? "", /Select an image/);
  assert.match(validateImageFile(fakeFile("image/jpeg", Buffer.from([0xff, 0xd8, 0xff]), 5 * 1024 * 1024 + 1)) ?? "", /5 MB/);
  assert.match(validateImageFile(fakeFile("image/gif", Buffer.from("GIF89a"))) ?? "", /JPEG, PNG, or WebP/);
  assert.match(validateImageFile(fakeFile("image/png", Buffer.from("not an image"))) ?? "", /does not match/);
});

test("image size limit is five megabytes", () => {
  const maximum = 5 * 1024 * 1024;
  assert.equal(validateImageFile(fakeFile("image/jpeg", Buffer.from([0xff, 0xd8, 0xff]), maximum)), null);
  assert.match(validateImageFile(fakeFile("image/jpeg", Buffer.from([0xff, 0xd8, 0xff]), maximum + 1)) ?? "", /5 MB/);
});
