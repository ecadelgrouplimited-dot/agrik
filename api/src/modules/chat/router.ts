import fs from "node:fs";
import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { upload, publicUrlFor } from "../../middleware/upload.js";
import { badRequest } from "../../lib/http-error.js";
import { env } from "../../config/env.js";
import { aiConfigured, audioConfigured, deepseek, extractJsonObject, openai } from "../../lib/ai.js";
import { CROPS } from "../reference/config.js";

const HISTORY_CONTEXT_MESSAGES = 10;
const HISTORY_CONTEXT_CHAR_LIMIT = 800;

/** Recent turns for this conversation, formatted for the model so short follow-up replies ("yes", "only two plants") are understood in context. */
async function buildHistoryContext(conversationId: string): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_CONTEXT_MESSAGES,
  });
  return rows
    .reverse()
    .map((row) => ({
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: row.message.length > HISTORY_CONTEXT_CHAR_LIMIT ? `${row.message.slice(0, HISTORY_CONTEXT_CHAR_LIMIT)}...` : row.message,
    }));
}

const router = Router();
router.use(requireAuth);

const CHAT_SYSTEM_PROMPT = `You are GRIK, AGRIK's field advisory assistant for smallholder farmers, buyers, and agri service providers in Uganda.
Answer practically and concisely. If a locale hint is given, respond in that language; otherwise reply in the same language as the user's message.
Always respond with a single JSON object, no prose outside it, matching exactly:
{
  "reply": string,
  "language": string,               // BCP-47-ish language name or code you responded in
  "follow_ups": string[]            // 0-3 short suggested follow-up questions
}`;

function titleFromMessage(message: string): string {
  const cleaned = message.trim().replace(/\s+/g, " ");
  if (!cleaned) return "New conversation";
  return cleaned.length > 60 ? `${cleaned.slice(0, 60)}...` : cleaned;
}

/** Ensures the given conversation id belongs to this user, or creates a fresh one seeded from the first message. */
async function resolveConversationId(userId: string, conversationId: string | undefined, seedMessage: string): Promise<string> {
  if (conversationId) {
    const existing = await prisma.chatConversation.findFirst({ where: { id: conversationId, userId }, select: { id: true } });
    if (!existing) throw badRequest("Conversation not found.");
    return existing.id;
  }
  const created = await prisma.chatConversation.create({
    data: { userId, title: titleFromMessage(seedMessage) },
    select: { id: true },
  });
  return created.id;
}

router.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    const conversations = await prisma.chatConversation.findMany({
      where: { userId: req.userId! },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: true } },
      },
    });
    res.json({
      items: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        created_at: c.createdAt.toISOString(),
        updated_at: c.updatedAt.toISOString(),
        message_count: c._count.messages,
        last_message: c.messages[0]?.message ?? null,
      })),
    });
  })
);

const createConversationSchema = z.object({
  title: z.string().optional(),
});

router.post(
  "/conversations",
  asyncHandler(async (req, res) => {
    const body = createConversationSchema.parse(req.body ?? {});
    const conversation = await prisma.chatConversation.create({
      data: { userId: req.userId!, title: body.title?.trim() || "New conversation" },
    });
    res.json({
      id: conversation.id,
      title: conversation.title,
      created_at: conversation.createdAt.toISOString(),
      updated_at: conversation.updatedAt.toISOString(),
      message_count: 0,
      last_message: null,
    });
  })
);

router.delete(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.chatConversation.findFirst({ where: { id: req.params.id, userId: req.userId! }, select: { id: true } });
    if (!existing) throw badRequest("Conversation not found.");
    await prisma.chatConversation.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  })
);

router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 30), 200);
    const conversationId = typeof req.query.conversation_id === "string" ? req.query.conversation_id : undefined;
    const items = await prisma.chatMessage.findMany({
      where: { userId: req.userId!, ...(conversationId ? { conversationId } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({
      items: items
        .reverse()
        .map((m) => {
          const metadata = (m.metadata as Record<string, unknown> | null) ?? {};
          return {
            id: m.id,
            role: m.role,
            message: m.message,
            created_at: m.createdAt.toISOString(),
            conversation_id: m.conversationId,
            follow_ups: metadata.follow_ups ?? undefined,
            media_analysis: metadata.media_analysis ?? undefined,
            attachments: metadata.attachments ?? undefined,
          };
        }),
    });
  })
);

const askSchema = z.object({
  message: z.string().min(1),
  locale_hint: z.string().optional(),
  location_hint: z.string().optional(),
  conversation_id: z.string().optional(),
});

router.post(
  "/ask",
  asyncHandler(async (req, res) => {
    const body = askSchema.parse(req.body);
    if (!aiConfigured()) throw badRequest("Chat AI is not configured on the server yet.");

    const conversationId = await resolveConversationId(req.userId!, body.conversation_id, body.message);
    const historyContext = await buildHistoryContext(conversationId);

    await prisma.chatMessage.create({ data: { userId: req.userId!, conversationId, role: "user", message: body.message } });
    await prisma.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

    const userPrompt = [
      body.locale_hint ? `Locale hint: ${body.locale_hint}` : null,
      body.location_hint ? `Location hint: ${body.location_hint}` : null,
      `Message: ${body.message}`,
    ]
      .filter(Boolean)
      .join("\n");

    const completion = await deepseek.chat.completions.create({
      model: env.deepseek.chatModel,
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        ...historyContext,
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 2200,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJsonObject(raw);
    const reply = (parsed?.reply as string) || raw || "I couldn't generate a response just now.";
    const language = (parsed?.language as string) || body.locale_hint || "en";
    const followUps = Array.isArray(parsed?.follow_ups) ? (parsed!.follow_ups as string[]) : [];

    await prisma.chatMessage.create({
      data: {
        userId: req.userId!,
        conversationId,
        role: "assistant",
        message: reply,
        metadata: followUps.length > 0 ? ({ follow_ups: followUps } as Prisma.InputJsonValue) : undefined,
      },
    });

    res.json({ reply, language, follow_ups: followUps, conversation_id: conversationId });
  })
);

const VISION_SYSTEM_PROMPT = `You are GRIK Vision, an agronomy image analyst for AGRIK. You inspect crop/field photos for smallholder farmers in Uganda.
Never stop at a bare diagnosis. Every response must give the farmer concrete next steps they can act on today, even when you are uncertain -- state your uncertainty in "overall_assessment" and still propose the most reasonable immediate_actions and field_checks to narrow it down.
Always respond with a single JSON object, no prose outside it, matching exactly:
{
  "overall_assessment": string,
  "likely_issues": [{ "name": string, "category": string, "confidence": number, "evidence": string, "recommended_action": string }],
  "immediate_actions": string[],      // 2-5 concrete actions the farmer should take now, ordered by priority
  "field_checks": string[],           // 1-4 things to go check in the field to confirm or rule out the diagnosis
  "top_labels": string[],
  "follow_ups": string[]              // 2-3 short follow-up questions the farmer could tap to continue this conversation
}`;

const multimodalSchema = z.object({
  message: z.string().min(1),
  locale_hint: z.string().optional(),
  location_hint: z.string().optional(),
  crop_hint: z.string().optional(),
  model_preference: z.string().optional(),
  deep_analysis: z.string().optional(),
  conversation_id: z.string().optional(),
});

router.post(
  "/ask-multimodal",
  upload.array("files", 6),
  asyncHandler(async (req, res) => {
    const body = multimodalSchema.parse(req.body);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw badRequest("At least one image is required for vision analysis.");
    if (!aiConfigured()) throw badRequest("Vision AI is not configured on the server yet.");

    const conversationId = await resolveConversationId(req.userId!, body.conversation_id, body.message);
    const historyContext = await buildHistoryContext(conversationId);

    // Keep uploaded photos (served from /uploads) instead of deleting them after
    // analysis, so the attachment thumbnail is still there after a page reload.
    const attachments = files
      .filter((file) => file.mimetype.startsWith("image/"))
      .map((file) => ({ name: file.originalname, url: publicUrlFor(file.filename) }));

    await prisma.chatMessage.create({
      data: {
        userId: req.userId!,
        conversationId,
        role: "user",
        message: body.message,
        metadata: attachments.length > 0 ? ({ attachments } as Prisma.InputJsonValue) : undefined,
      },
    });
    await prisma.chatConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

    const imageContents = files.slice(0, 6).map((file) => {
      const base64 = fs.readFileSync(file.path).toString("base64");
      return {
        type: "image_url" as const,
        image_url: { url: `data:${file.mimetype};base64,${base64}` },
      };
    });

    const textPrompt = [
      body.locale_hint ? `Locale hint: ${body.locale_hint}` : null,
      body.location_hint ? `Location hint: ${body.location_hint}` : null,
      body.crop_hint ? `Crop hint: ${body.crop_hint}` : null,
      `Deep analysis requested: ${body.deep_analysis === "true"}`,
      `Farmer message: ${body.message}`,
    ]
      .filter(Boolean)
      .join("\n");

    const completion = await deepseek.chat.completions.create({
      model: env.deepseek.visionModel,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        ...historyContext,
        {
          role: "user",
          content: [{ type: "text", text: textPrompt }, ...imageContents],
        },
      ],
      temperature: 0.3,
      // This model reasons internally before writing the JSON answer, and those hidden
      // reasoning tokens count against max_tokens -- observed 300-900+ reasoning tokens
      // per image even on simple prompts. A low budget here silently truncates the
      // response to nothing (finish_reason: "length" with empty content).
      max_tokens: body.deep_analysis === "true" ? 8000 : 6000,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJsonObject(raw);
    const truncated = completion.choices[0]?.finish_reason === "length";
    const analysisFailed = !parsed;

    const fallbackActions = truncated
      ? [
          "This photo needed more thinking than usual and got cut off -- send it again, ideally a single close-up of the affected leaf, stalk, or ear.",
          "If it fails again, describe what you're seeing in a text message and GRIK can still advise you.",
        ]
      : analysisFailed
      ? [
          "Retake the photo in good daylight, close enough to clearly show the affected part of the plant.",
          "Describe what you're seeing (spots, wilting, discoloration) so GRIK can advise even without a clear image read.",
        ]
      : [];

    const mediaAnalysis = {
      overall_assessment:
        (parsed?.overall_assessment as string) ||
        (truncated
          ? "The analysis didn't finish in time for this photo."
          : "Couldn't read a clear diagnosis from this photo."),
      likely_issues: Array.isArray(parsed?.likely_issues) ? parsed!.likely_issues : [],
      immediate_actions: Array.isArray(parsed?.immediate_actions) && parsed!.immediate_actions.length > 0
        ? (parsed!.immediate_actions as string[])
        : fallbackActions,
      field_checks: Array.isArray(parsed?.field_checks) ? parsed!.field_checks : [],
      media_count: files.length,
      model: env.deepseek.visionModel,
      selected_model_reason: body.model_preference ? `Requested: ${body.model_preference}` : null,
      crop_hint: body.crop_hint ?? null,
      deep_analysis: body.deep_analysis === "true",
      top_labels: Array.isArray(parsed?.top_labels) ? parsed!.top_labels : [],
    };

    const followUps = Array.isArray(parsed?.follow_ups) ? (parsed!.follow_ups as string[]) : [];

    const replyParts = [mediaAnalysis.overall_assessment];
    if (mediaAnalysis.immediate_actions.length > 0) {
      replyParts.push(
        ["Next steps:", ...mediaAnalysis.immediate_actions.map((action, index) => `${index + 1}. ${action}`)].join("\n")
      );
    }
    const reply = replyParts.join("\n\n");

    await prisma.chatMessage.create({
      data: {
        userId: req.userId!,
        conversationId,
        role: "assistant",
        message: reply,
        metadata: { follow_ups: followUps, media_analysis: mediaAnalysis } as Prisma.InputJsonValue,
      },
    });

    res.json({
      reply,
      language: body.locale_hint || "en",
      follow_ups: followUps,
      media_analysis: mediaAnalysis,
      conversation_id: conversationId,
    });
  })
);

router.post(
  "/transcribe-audio",
  upload.single("audio"),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest("Audio file is required.");
    if (!audioConfigured()) throw badRequest("Audio transcription is not configured on the server yet.");

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(file.path),
      model: env.openai.transcribeModel,
      language: req.body.locale_hint || undefined,
    });

    fs.unlink(file.path, () => undefined);

    res.json({
      transcript: transcription.text,
      language: req.body.locale_hint || null,
      confidence: null,
      model: env.openai.transcribeModel,
    });
  })
);

const synthesizeSchema = z.object({
  text: z.string().min(1),
  locale_hint: z.string().optional(),
  voice_hint: z.string().optional(),
  speech_mode: z.enum(["full", "summary"]).optional(),
});

router.post(
  "/synthesize-audio",
  asyncHandler(async (req, res) => {
    const body = synthesizeSchema.parse(req.body);
    if (!audioConfigured()) throw badRequest("Speech synthesis is not configured on the server yet.");

    const textToSpeak = body.speech_mode === "summary" ? body.text.slice(0, 400) : body.text;

    const speech = await openai.audio.speech.create({
      model: env.openai.ttsModel,
      voice: body.voice_hint || env.openai.ttsVoice,
      input: textToSpeak,
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(buffer);
  })
);

router.get(
  "/vision/options",
  asyncHandler(async (_req, res) => {
    res.json({
      models: [
        { id: env.deepseek.visionModel, label: "GRIK Vision", tip: "Best for detailed crop/pest photo analysis." },
      ],
      crops: CROPS,
    });
  })
);

export default router;
