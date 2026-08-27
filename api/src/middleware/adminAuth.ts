import type { NextFunction, Request, Response } from "express";
import { verifyAdminToken } from "../lib/jwt.js";
import { unauthorized } from "../lib/http-error.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

export function requireAdminAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(unauthorized());
  }
  try {
    const payload = verifyAdminToken(header.slice("Bearer ".length));
    req.adminId = payload.sub;
    next();
  } catch {
    next(unauthorized());
  }
}
