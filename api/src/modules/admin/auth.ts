import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import { badRequest, notFound, unauthorized } from "../../lib/http-error.js";
import { generateNumericCode, hashCode, verifyCode, verifyPassword } from "../../lib/password.js";
import { signAdminToken } from "../../lib/jwt.js";
import { normalizeEmail } from "../auth/phone.js";
import { sendAdminOtpEmail } from "../../lib/mailer.js";

const router = Router();
const OTP_TTL_MS = 10 * 60 * 1000;

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
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) throw unauthorized("Invalid admin credentials.");

    const valid = await verifyPassword(body.password, admin.passwordHash);
    if (!valid) throw unauthorized("Invalid admin credentials.");
    if (admin.status !== "active") throw unauthorized("This admin account is not active.");

    const code = generateNumericCode();
    const codeHash = await hashCode(code);
    await prisma.adminOtp.create({ data: { adminId: admin.id, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) } });
    try {
      await sendAdminOtpEmail(admin.email, code);
    } catch (err) {
      console.error("Failed to send admin OTP email", err);
    }

    res.json({ status: "otp_sent" });
  })
);

const verifySchema = z.object({ email: z.string().email(), code: z.string().min(4) });

router.post(
  "/verify-otp",
  asyncHandler(async (req, res) => {
    const body = verifySchema.parse(req.body);
    const email = normalizeEmail(body.email);
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) throw notFound("Admin not found.");

    const record = await prisma.adminOtp.findFirst({
      where: { adminId: admin.id, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw badRequest("Code expired. Sign in again to get a new one.");

    const valid = await verifyCode(body.code, record.codeHash);
    if (!valid) throw badRequest("Incorrect code.");

    await prisma.adminOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

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
