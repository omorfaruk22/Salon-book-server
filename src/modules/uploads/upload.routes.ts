import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { authenticate, requireRole } from "../../middleware/authenticate";
import { authenticatedIdentity, createRateLimiter } from "../../middleware/rate-limit";
import { uploadImage } from "./upload.controller";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "./image-upload.validation";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter(_req, file, callback) {
    if ((ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) return callback(null, true);
    return callback(Object.assign(new Error("Choose a JPEG, PNG, or WebP image."), { status: 400 }));
  },
});

function parseSingleImage(req: Request, res: Response, next: NextFunction) {
  upload.single("image")(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE" ? "Image must be smaller than 5 MB." : "Upload one image file using the image field.";
      return res.status(400).json({ data: null, error: { message } });
    }
    return next(error);
  });
}

export const uploadRouter = Router();
const imageUploadLimit = createRateLimiter({ windowMs: 15 * 60_000, maxRequests: 12, keyGenerator: (req) => `image-upload:${authenticatedIdentity(req)}`, message: "Too many image uploads. Please wait before trying again." });
uploadRouter.post("/image", authenticate, requireRole("admin"), imageUploadLimit, parseSingleImage, uploadImage);
// The shared ImgBB utility also supports profile uploads. This separate route keeps
// service-image uploads restricted to Admins while preserving customer profiles.
uploadRouter.post("/profile-image", authenticate, requireRole("admin", "customer"), imageUploadLimit, parseSingleImage, uploadImage);
