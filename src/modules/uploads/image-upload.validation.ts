export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateImageFile(file: Express.Multer.File | undefined): string | null {
  if (!file) return "Select an image to upload.";
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) return "Choose a JPEG, PNG, or WebP image.";
  if (!file.size || file.size > MAX_IMAGE_BYTES) return "Image must be smaller than 5 MB.";

  const extension = file.originalname.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  if (extension) {
    const compatibleExtensions: Record<(typeof ACCEPTED_IMAGE_TYPES)[number], readonly string[]> = {
      "image/jpeg": ["jpg", "jpeg"],
      "image/png": ["png"],
      "image/webp": ["webp"],
    };
    if (!compatibleExtensions[file.mimetype as (typeof ACCEPTED_IMAGE_TYPES)[number]]?.includes(extension)) {
      return "The image file extension does not match its content type.";
    }
  }

  const bytes = file.buffer;
  const validSignature = file.mimetype === "image/jpeg"
    ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.mimetype === "image/png"
      ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : bytes.length >= 30
        && bytes.subarray(0, 4).toString("ascii") === "RIFF"
        && bytes.subarray(8, 12).toString("ascii") === "WEBP"
        && bytes.readUInt32LE(4) <= bytes.length - 8;
  return validSignature ? null : "Image content does not match its file type.";
}
