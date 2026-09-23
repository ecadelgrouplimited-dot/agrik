import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import { badGateway, badRequest, notFound, tooManyRequests, unauthorized } from "../../lib/http-error.js";
import { checkThrottle, clearThrottle, recordFailure, type ThrottleOptions } from "../../lib/throttle.js";
import { generateNumericCode, hashCode, verifyCode, verifyPassword } from "../../lib/password.js";
import { signAdminToken } from "../../lib/jwt.js";
import { normalizeEmail } from "../auth/phone.js";
import { sendAdminOtpEmail } from "../../lib/mailer.js";

const router = Router();
const OTP_TTL_MS = 10 * 60 * 1000;

// Console access is the highest-value credential in the system, so guessing is capped
// hard. Password and code are counted separately: burning code attempts should not lock
// out the password, and vice versa.
const PASSWORD_THROTTLE: ThrottleOptions = { limit: 5, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 };
const CODE_THROTTLE: ThrottleOptions = { limit: 5, windowMs: 10 * 60 * 1000, blockMs: 10 * 60 * 1000 };

function throttleKey(scope: string, email: string, ip: string | undefined) {
  return `${scope}:${email}:${ip ?? "unknown"}`;
}

async function logAdminActivity(adminId: string, action: string, details: Record<string, unknown>, ip: string | undefined) {
  try {
    await prisma.adminActivity.create({ data: { adminId, action, details: details as Prisma.InputJsonValue, ipAddress: ip ?? null } });
  } catch (err) {
    // An audit write must never be the reason a sign-in fails.
    console.error("Failed to record admin activity", err);
  }
}

function toAdminOut(admin: { id: string; email: string; status: string; verificationStatus: string; createdAt: Date }) {
  return {
    id: admin.id,
    email: admin.email,
    status: admin.status,
    verification_status: admin.verificationStatus,
    created_at: admin.createdAt.toISOString(),
  };
}

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const email = normalizeEmail(body.email);

    const key = throttleKey("admin-password", email, req.ip);
    const verdict = checkThrottle(key, PASSWORD_THROTTLE);
    if (!verdict.allowed) {
      throw tooManyRequests(`Too many sign-in attempts. Try again in ${Math.ceil(verdict.retryAfterSeconds / 60)} minute(s).`);
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      recordFailure(key, PASSWORD_THROTTLE);
      throw unauthorized("Invalid admin credentials.");
    }

    const valid = await verifyPassword(body.password, admin.passwordHash);
    if (!valid) {
      recordFailure(key, PASSWORD_THROTTLE);
      await logAdminActivity(admin.id, "admin_login_failed", { reason: "bad_password" }, req.ip);
      throw unauthorized("Invalid admin credentials.");
    }
    if (admin.status !== "active") {
      recordFailure(key, PASSWORD_THROTTLE);
      throw unauthorized("This admin account is not active.");
    }

    clearThrottle(key);

    const code = generateNumericCode();
    const codeHash = await hashCode(code);
    const otp = await prisma.adminOtp.create({
      data: { adminId: admin.id, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });

    try {
      await sendAdminOtpEmail(admin.email, code);
    } catch (err) {
      // The console used to answer "otp_sent" here regardless, which left the operator
      // waiting for a code that was never going to arrive. Fail loudly instead, and drop
      // the unusable code so it cannot be brute-forced later.
      console.error("Failed to send admin OTP email", err);
      await prisma.adminOtp.delete({ where: { id: otp.id } }).catch(() => undefined);
      throw badGateway("Could not send your sign-in code. Check the mail server configuration and try again.");
    }

    await logAdminActivity(admin.id, "admin_login_code_sent", {}, req.ip);
    res.json({ status: "otp_sent", expires_in_seconds: OTP_TTL_MS / 1000 });
  })
);

const verifySchema = z.object({ email: z.string().email(), code: z.string().min(4) });

router.post(
  "/verify-otp",
  asyncHandler(async (req, res) => {
    const body = verifySchema.parse(req.body);
    const email = normalizeEmail(body.email);

    const key = throttleKey("admin-code", email, req.ip);
    const verdict = checkThrottle(key, CODE_THROTTLE);
    if (!verdict.allowed) {
      throw tooManyRequests(`Too many code attempts. Sign in again in ${Math.ceil(verdict.retryAfterSeconds / 60)} minute(s).`);
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) throw notFound("Admin not found.");

    const record = await prisma.adminOtp.findFirst({
      where: { adminId: admin.id, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw badRequest("Code expired. Sign in again to get a new one.");

    const valid = await verifyCode(body.code, record.codeHash);
    if (!valid) {
      recordFailure(key, CODE_THROTTLE);
      await logAdminActivity(admin.id, "admin_login_failed", { reason: "bad_code" }, req.ip);
      throw badRequest("Incorrect code.");
    }

    await prisma.adminOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
    clearThrottle(key);
    await logAdminActivity(admin.id, "admin_signed_in", {}, req.ip);

    const token = signAdminToken(admin.id);
    res.json({ token, admin: toAdminOut(admin) });
  })
);

router.get(
  "/me",
  requireAdminAuth,
  asyncHandler(async (req, res) => {
    const admin = await prisma.admin.findUnique({ where: { id: req.adminId! } });
    if (!admin) throw notFound("Admin not found.");
    res.json(toAdminOut(admin));
  })
);

export default router;
