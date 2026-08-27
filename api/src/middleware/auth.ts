import type { NextFunction, Request, Response } from "express";
import { verifyUserToken } from "../lib/jwt.js";
import { unauthorized } from "../lib/http-error.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(unauthorized());
  }
  try {
    const payload = verifyUserToken(header.slice("Bearer ".length));
    req.userId = payload.sub;
    next();
  } catch {
    next(unauthorized());
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = verifyUserToken(header.slice("Bearer ".length));
      req.userId = payload.sub;
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}
