import fs from "node:fs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../middleware/errorHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { upload } from "../../middleware/upload.js";
import { badRequest } from "../../lib/http-error.js";
import { env } from "../../config/env.js";
import { aiConfigured, audioConfigured, deepseek, extractJsonObject, openai } from "../../lib/ai.js";
import { CROPS } from "../reference/config.js";

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

router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 30), 200);
    const items = await prisma.chatMessage.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json({
      items: items
        .reverse()
        .map((m) => ({ id: m.id, role: m.role, message: m.message, created_at: m.createdAt.toISOString() })),
    });
  })
);

const askSchema = z.object({
  message: z.string().min(1),
  locale_hint: z.string().optional(),
  location_hint: z.string().optional(),
});

router.post(
  "/ask",
  asyncHandler(async (req, res) => {
    const body = askSchema.parse(req.body);
    if (!aiConfigured()) throw badRequest("Chat AI is not configured on the server yet.");

    await prisma.chatMessage.create({ data: { userId: req.userId!, role: "user", message: body.message } });

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
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJsonObject(raw);
    const reply = (parsed?.reply as string) || raw || "I couldn't generate a response just now.";
    const language = (parsed?.language as string) || body.locale_hint || "en";
    const followUps = Array.isArray(parsed?.follow_ups) ? (parsed!.follow_ups as string[]) : [];

    await prisma.chatMessage.create({ data: { userId: req.userId!, role: "assistant", message: reply } });

    res.json({ reply, language, follow_ups: followUps });
  })
);

const VISION_SYSTEM_PROMPT = `You are GRIK Vision, an agronomy image analyst for AGRIK. You inspect crop/field photos for smallholder farmers in Uganda.
Always respond with a single JSON object, no prose outside it, matching exactly:
{
  "overall_assessment": string,
  "likely_issues": [{ "name": string, "category": string, "confidence": number, "evidence": string, "recommended_action": string }],
  "immediate_actions": string[],
  "field_checks": string[],
  "top_labels": string[]
}`;

const multimodalSchema = z.object({
  message: z.string().min(1),
  locale_hint: z.string().optional(),
  location_hint: z.string().optional(),
  crop_hint: z.string().optional(),
  model_preference: z.string().optional(),
  deep_analysis: z.string().optional(),
});

router.post(
  "/ask-multimodal",
  upload.array("files", 6),
  asyncHandler(async (req, res) => {
    const body = multimodalSchema.parse(req.body);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw badRequest("At least one image is required for vision analysis.");
    if (!aiConfigured()) throw badRequest("Vision AI is not configured on the server yet.");

    await prisma.chatMessage.create({ data: { userId: req.userId!, role: "user", message: body.message } });

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
        {
          role: "user",
          content: [{ type: "text", text: textPrompt }, ...imageContents],
        },
      ],
      temperature: 0.3,
    });

    for (const file of files) {
      fs.unlink(file.path, () => undefined);
    }

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJsonObject(raw);

    const mediaAnalysis = {
      overall_assessment: (parsed?.overall_assessment as string) || "Analysis unavailable for these images.",
      likely_issues: Array.isArray(parsed?.likely_issues) ? parsed!.likely_issues : [],
      immediate_actions: Array.isArray(parsed?.immediate_actions) ? parsed!.immediate_actions : [],
      field_checks: Array.isArray(parsed?.field_checks) ? parsed!.field_checks : [],
      media_count: files.length,
      model: env.deepseek.visionModel,
      selected_model_reason: body.model_preference ? `Requested: ${body.model_preference}` : null,
      crop_hint: body.crop_hint ?? null,
      deep_analysis: body.deep_analysis === "true",
      top_labels: Array.isArray(parsed?.top_labels) ? parsed!.top_labels : [],
    };

    const reply = mediaAnalysis.overall_assessment;
    await prisma.chatMessage.create({ data: { userId: req.userId!, role: "assistant", message: reply } });

    res.json({
      reply,
      language: body.locale_hint || "en",
      media_analysis: mediaAnalysis,
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
        { id: env.deepseek.visionModel, label: "DeepSeek Vision", tip: "Best for detailed crop/pest photo analysis." },
      ],
      crops: CROPS,
    });
  })
);

export default router;
