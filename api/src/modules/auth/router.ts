import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { badRequest, conflict, notFound, unauthorized } from "../../lib/http-error.js";
import { hashPassword, verifyPassword, generateNumericCode, hashCode, verifyCode } from "../../lib/password.js";
import { signUserToken } from "../../lib/jwt.js";
import { normalizeEmail, normalizePhone } from "./phone.js";
import { sendPasswordResetEmail, sendVerificationEmail, sendWelcomeEmail } from "../../lib/mailer.js";

const router = Router();

const VERIFICATION_TTL_MS = 15 * 60 * 1000;

function toAuthUserOut(user: {
  id: string;
  phone: string;
  email: string;
  role: string;
  status: string;
  verificationStatus: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
    verification_status: user.verificationStatus,
    created_at: user.createdAt.toISOString(),
  };
}

async function issueVerificationCode(userId: string, email: string) {
  const code = generateNumericCode();
  const codeHash = await hashCode(code);
  await prisma.emailVerification.create({
    data: {
      userId,
      codeHash,
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
    },
  });
  try {
    await sendVerificationEmail(email, code);
  } catch (err) {
    console.error("Failed to send verification email", err);
  }
}

const registerSchema = z.object({
  phone: z.string().min(6),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["farmer", "buyer", "offtaker", "service_provider", "input_supplier"]),
  full_name: z.string().min(1),
  district: z.string().min(1),
  parish: z.string().min(1),
  crops: z.array(z.string()).optional(),
  organization_name: z.string().nullable().optional(),
  service_categories: z.array(z.string()).optional(),
  focus_crops: z.array(z.string()).optional(),
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const phone = normalizePhone(body.phone);
    const email = normalizeEmail(body.email);

    const existing = await prisma.user.findFirst({ where: { OR: [{ phone }, { email }] } });
    if (existing) {
      throw conflict(existing.phone === phone ? "Phone number already registered." : "Email already registered.");
    }

    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        phone,
        email,
        passwordHash,
        role: body.role,
        identity: {
          create: {
            fullName: body.full_name,
            district: body.district,
            parish: body.parish,
            crops: body.crops ?? [],
            organizationName: body.organization_name ?? null,
            serviceCategories: body.service_categories ?? [],
            focusCrops: body.focus_crops ?? [],
          },
        },
        settings: { create: {} },
        farm: { create: {} },
      },
    });

    await issueVerificationCode(user.id, email);

    res.json({
      status: "verification_required",
      message: "We sent a verification code to your email. Enter it to activate your account.",
    });
  })
);

router.get(
  "/phone-availability",
  asyncHandler(async (req, res) => {
    const raw = String(req.query.phone ?? "");
    if (!raw) throw badRequest("phone is required");
    const normalized = normalizePhone(raw);
    const existing = await prisma.user.findUnique({ where: { phone: normalized } });
    res.json({ phone: raw, normalized_phone: normalized, available: !existing });
  })
);

router.get(
  "/email-availability",
  asyncHandler(async (req, res) => {
    const raw = String(req.query.email ?? "");
    if (!raw) throw badRequest("email is required");
    const normalized = normalizeEmail(raw);
    const existing = await prisma.user.findUnique({ where: { email: normalized } });
    res.json({ email: raw, normalized_email: normalized, available: !existing });
  })
);

const loginSchema = z.object({
  phone: z.string().min(6),
  password: z.string().min(1).optional().nullable(),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    if (!body.password) throw badRequest("password is required");

    const phone = normalizePhone(body.phone);
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) throw unauthorized("Invalid phone number or password.");

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) throw unauthorized("Invalid phone number or password.");

    if (user.verificationStatus !== "verified") {
      await issueVerificationCode(user.id, user.email);
      res.json({
        status: "verification_required",
        message: "Please verify your email to continue. We just sent a new code.",
        user: toAuthUserOut(user),
      });
      return;
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = signUserToken(user.id);
    res.json({ status: "logged_in", token, user: toAuthUserOut(user) });
  })
);

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
});

router.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const body = verifySchema.parse(req.body);
    const email = normalizeEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw notFound("Account not found.");

    const record = await prisma.emailVerification.findFirst({
      where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw badRequest("Code expired. Request a new one.");

    const valid = await verifyCode(body.code, record.codeHash);
    if (!valid) throw badRequest("Incorrect code.");

    await prisma.$transaction([
      prisma.emailVerification.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
      prisma.user.update({ where: { id: user.id }, data: { verificationStatus: "verified", status: "active" } }),
    ]);

    const identity = await prisma.identity.findUnique({ where: { userId: user.id } });
    try {
      await sendWelcomeEmail(user.email, identity?.fullName ?? "");
    } catch (err) {
      console.error("Failed to send welcome email", err);
    }

    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const token = signUserToken(user.id);
    res.json({ token, user: toAuthUserOut(refreshed) });
  })
);

const resendSchema = z.object({ email: z.string().email() });

router.post(
  "/resend-verification-code",
  asyncHandler(async (req, res) => {
    const body = resendSchema.parse(req.body);
    const email = normalizeEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw notFound("Account not found.");
    if (user.verificationStatus === "verified") {
      res.json({ status: "already_verified", message: "This account is already verified." });
      return;
    }
    await issueVerificationCode(user.id, email);
    res.json({ status: "sent", message: "A new verification code has been sent to your email.", user: toAuthUserOut(user) });
  })
);

const forgotRequestSchema = z.object({ email: z.string().email() });

router.post(
  "/forgot-password/request",
  asyncHandler(async (req, res) => {
    const body = forgotRequestSchema.parse(req.body);
    const email = normalizeEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    // Always respond success to avoid leaking which emails are registered.
    if (user) {
      const code = generateNumericCode();
      const codeHash = await hashCode(code);
      await prisma.passwordReset.create({
        data: { userId: user.id, codeHash, expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS) },
      });
      try {
        await sendPasswordResetEmail(email, code);
      } catch (err) {
        console.error("Failed to send password reset email", err);
      }
    }
    res.json({ status: "sent", message: "If that email is registered, a reset code is on its way." });
  })
);

const forgotResetSchema = z.object({
  email: z.string().email(),
  code: z.string().min(4),
  password: z.string().min(6),
});

router.post(
  "/forgot-password/reset",
  asyncHandler(async (req, res) => {
    const body = forgotResetSchema.parse(req.body);
    const email = normalizeEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw notFound("Account not found.");

    const record = await prisma.passwordReset.findFirst({
      where: { userId: user.id, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!record) throw badRequest("Code expired. Request a new one.");

    const valid = await verifyCode(body.code, record.codeHash);
    if (!valid) throw badRequest("Incorrect code.");

    const passwordHash = await hashPassword(body.password);
    await prisma.$transaction([
      prisma.passwordReset.update({ where: { id: record.id }, data: { consumedAt: new Date() } }),
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    ]);

    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const token = signUserToken(user.id);
    res.json({ token, user: toAuthUserOut(refreshed) });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) throw notFound("Account not found.");
    res.json(toAuthUserOut(user));
  })
);

export default router;
