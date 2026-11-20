import assert from "node:assert/strict";
import test from "node:test";
import { validateImageFile } from "../src/modules/uploads/image-upload.validation";

function image(mimetype: string, originalname: string, buffer: Buffer) {
  return { mimetype, originalname, buffer, size: buffer.length } as Express.Multer.File;
}

test("image uploads require allowed MIME type, size, matching extension, and matching content signature", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jkXcAAAAASUVORK5CYII=", "base64");
  assert.equal(validateImageFile(image("image/png", "photo.png", png)), null);
  assert.equal(validateImageFile(image("application/x-msdownload", "payload.exe", Buffer.from("MZ"))), "Choose a JPEG, PNG, or WebP image.");
  assert.equal(validateImageFile(image("image/png", "payload.exe", png)), "The image file extension does not match its content type.");
  assert.equal(validateImageFile(image("image/png", "fake.png", Buffer.from("not an image"))), "Image content does not match its file type.");
});

test("image uploads reject empty and oversized files", () => {
  assert.equal(validateImageFile(image("image/png", "empty.png", Buffer.alloc(0))), "Image must be smaller than 5 MB.");
  assert.equal(validateImageFile(image("image/png", "large.png", Buffer.alloc(5 * 1024 * 1024 + 1))), "Image must be smaller than 5 MB.");
});
