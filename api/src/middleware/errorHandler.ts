import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error.js";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ detail: "Route not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const detail = err.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    res.status(422).json({ detail });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ detail: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ detail: "Internal server error" });
}

export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => Promise<unknown>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
