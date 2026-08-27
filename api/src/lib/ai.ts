import OpenAI from "openai";
import { env } from "../config/env.js";

export const deepseek = new OpenAI({
  apiKey: env.deepseek.apiKey || "missing-deepseek-key",
  baseURL: env.deepseek.baseUrl,
});

export const openai = new OpenAI({
  apiKey: env.openai.apiKey || "missing-openai-key",
});

export function aiConfigured() {
  return Boolean(env.deepseek.apiKey);
}

export function audioConfigured() {
  return Boolean(env.openai.apiKey);
}

/** Best-effort extraction of a JSON object from a model response that may be wrapped in prose or code fences. */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
