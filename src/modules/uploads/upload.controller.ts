import type { NextFunction, Request, Response } from "express";
import { uploadImageToImgBB } from "./image-upload.service";
import { validateImageFile } from "./image-upload.validation";

export async function uploadImage(req: Request, res: Response, next: NextFunction) {
  const validationError = validateImageFile(req.file);
  if (validationError) return res.status(400).json({ data: null, error: { message: validationError } });
  try {
    const uploaded = await uploadImageToImgBB(req.file!);
    return res.status(201).json({ data: uploaded, error: null });
  } catch (error) { return next(error); }
}
