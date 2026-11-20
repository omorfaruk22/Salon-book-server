import { env } from "../../config/env";
import { validateImageFile } from "./image-upload.validation";

export async function uploadImageToImgBB(file: Express.Multer.File) {
  if (!env.IMGBB_API_KEY) throw Object.assign(new Error("Image upload is not configured. Set IMGBB_API_KEY on the server."), { status: 503 });

  const filename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "salonbook-image";
  const form = new FormData();
  form.set("image", new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), filename);
  let response: Response;
  try {
    response = await fetch("https://api.imgbb.com/1/upload?key=" + encodeURIComponent(env.IMGBB_API_KEY), {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw Object.assign(new Error("ImgBB is unavailable right now. Check the server network and try again."), { status: 502 });
  }
  const result = await response.json().catch(() => null) as {
    success?: boolean;
    data?: { url?: string; display_url?: string };
  } | null;
  const url = result?.data?.display_url ?? result?.data?.url;
  let hostedByImgBB = false;
  try {
    const parsedUrl = new URL(url ?? "");
    hostedByImgBB = parsedUrl.protocol === "https:" && parsedUrl.hostname === "i.ibb.co";
  } catch { /* no URL returned */ }
  if (!response.ok || !result?.success || !hostedByImgBB || !url) {
    throw Object.assign(new Error("ImgBB could not complete the image upload. Check the server API key and try again."), { status: 502 });
  }
  return { url, mimeType: file.mimetype, size: file.size };
}
