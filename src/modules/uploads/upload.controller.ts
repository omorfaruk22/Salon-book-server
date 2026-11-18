import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

const uploadSchema = z.object({
  image: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  name: z.string().trim().max(150).optional(),
}).strict();

export async function uploadImage(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) return res.status(503).json({ data: null, error: { message: "Image upload is not configured. Set IMGBB_API_KEY on the server." } });
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ data: null, error: { message: "Provide a JPEG, PNG, or WebP image." } });
  const bytes = Buffer.from(parsed.data.image, "base64");
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) return res.status(400).json({ data: null, error: { message: "Image must be smaller than 5 MB." } });
  if (bytes.toString("base64").replace(/=+$/, "") !== parsed.data.image.replace(/=+$/, "")) return res.status(400).json({ data: null, error: { message: "Invalid image data." } });
  const signatureValid = parsed.data.mimeType === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : parsed.data.mimeType === "image/png" ? bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!signatureValid) return res.status(400).json({ data: null, error: { message: "Image content does not match its file type." } });

  try {
    const form = new FormData();
    form.set("image", parsed.data.image);
    if (parsed.data.name) form.set("name", parsed.data.name.replace(/\.[^.]+$/, "").slice(0, 150));
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, { method: "POST", body: form });
    const result = await response.json() as { success?: boolean; data?: { url?: string; display_url?: string }; error?: { message?: string } };
    const url = result.data?.display_url ?? result.data?.url;
    if (!response.ok || !result.success || !url) return res.status(502).json({ data: null, error: { message: result.error?.message ?? "Image hosting rejected the upload." } });
    return res.status(201).json({ data: { url }, error: null });
  } catch (error) { return next(error); }
}
