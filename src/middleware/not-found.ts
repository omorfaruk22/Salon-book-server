import type { Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    data: null,
    error: { message: `Route ${req.method} ${req.path} not found` },
  });
}
