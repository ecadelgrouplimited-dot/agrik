import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type UserTokenPayload = { sub: string; kind: "user" };
export type AdminTokenPayload = { sub: string; kind: "admin" };

export function signUserToken(userId: string): string {
  const payload: UserTokenPayload = { sub: userId, kind: "user" };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyUserToken(token: string): UserTokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret) as UserTokenPayload;
  if (decoded.kind !== "user") throw new Error("Invalid token kind");
  return decoded;
}

export function signAdminToken(adminId: string): string {
  const payload: AdminTokenPayload = { sub: adminId, kind: "admin" };
  return jwt.sign(payload, env.adminJwtSecret, { expiresIn: env.adminJwtExpiresIn } as jwt.SignOptions);
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  const decoded = jwt.verify(token, env.adminJwtSecret) as AdminTokenPayload;
  if (decoded.kind !== "admin") throw new Error("Invalid token kind");
  return decoded;
}
