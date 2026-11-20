export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateImageFile(file: Express.Multer.File | undefined): string | null {
  if (!file) return "Select an image to upload.";
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) return "Choose a JPEG, PNG, or WebP image.";
  if (!file.size || file.size > MAX_IMAGE_BYTES) return "Image must be smaller than 5 MB.";

  const bytes = file.buffer;
  const validSignature = file.mimetype === "image/jpeg"
    ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.mimetype === "image/png"
      ? bytes.length >= 8 && bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      : bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return validSignature ? null : "Image content does not match its file type.";
}
