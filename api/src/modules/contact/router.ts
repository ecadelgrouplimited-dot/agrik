import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { badRequest, tooManyRequests } from "../../lib/http-error.js";
import { checkThrottle, recordFailure, type ThrottleOptions } from "../../lib/throttle.js";
import { sendContactAcknowledgementEmail, sendContactNotificationEmail } from "../../lib/mailer.js";
import { env } from "../../config/env.js";
import { normalizeEmail } from "../auth/phone.js";

const router = Router();

export const CONTACT_TOPICS = [
  "General enquiry",
  "Getting started",
  "Advisory and alerts",
  "Marketplace and selling",
  "Plans and billing",
  "Partnership",
  "Report a problem",
] as const;

/**
 * The form is open to the internet and every submission sends two emails, so it is capped
 * per address and per IP. The counter is recorded on every submission, not only failures,
 * because here a "success" is the thing being abused.
 */
const SUBMIT_THROTTLE: ThrottleOptions = { limit: 5, windowMs: 60 * 60 * 1000, blockMs: 60 * 60 * 1000 };

const contactSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(120),
  email: z.string().trim().email("Enter an email we can reply to."),
  phone: z.string().trim().max(32).optional().nullable(),
  topic: z.enum(CONTACT_TOPICS),
  message: z.string().trim().min(20, "Give us a little more detail — at least 20 characters.").max(4000),
  /** Honeypot: a real person never sees this field, so anything in it is a bot. */
  website: z.string().max(0).optional(),
});

router.get("/topics", (_req, res) => {
  res.json({ topics: CONTACT_TOPICS });
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = contactSchema.parse(req.body);
    if (body.website) throw badRequest("Unable to send this message.");

    const email = normalizeEmail(body.email);
    const ipKey = `contact-ip:${req.ip ?? "unknown"}`;
    const emailKey = `contact-email:${email}`;
    for (const key of [ipKey, emailKey]) {
      const verdict = checkThrottle(key, SUBMIT_THROTTLE);
      if (!verdict.allowed) {
        throw tooManyRequests("You have sent several messages already. We will reply to those first.");
      }
    }

    const record = await prisma.contactMessage.create({
      data: {
        name: body.name,
        email,
        phone: body.phone?.trim() || null,
        topic: body.topic,
        message: body.message,
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
      },
    });

    // Count the submission only once it is stored, so a validation failure cannot burn
    // someone's allowance.
    recordFailure(ipKey, SUBMIT_THROTTLE);
    recordFailure(emailKey, SUBMIT_THROTTLE);

    const enquiry = {
      id: record.id,
      name: record.name,
      email: record.email,
      phone: record.phone,
      topic: record.topic,
      message: record.message,
    };

    // The message is already saved, so a mail failure must not lose it or fail the
    // request for the sender. It is recorded on the row instead, and the console shows
    // which enquiries never reached the inbox.
    const [notified, acknowledged] = await Promise.all([
      sendContactNotificationEmail(env.smtp.contactInbox, enquiry)
        .then(() => true)
        .catch((err) => {
          console.error(`Contact #${record.id}: failed to notify ${env.smtp.contactInbox}`, err);
          return false;
        }),
      sendContactAcknowledgementEmail(enquiry)
        .then(() => true)
        .catch((err) => {
          console.error(`Contact #${record.id}: failed to acknowledge ${record.email}`, err);
          return false;
        }),
    ]);

    await prisma.contactMessage.update({ where: { id: record.id }, data: { notified, acknowledged } });

    res.status(201).json({ status: "received", reference: record.id, acknowledged });
  })
);

export default router;
