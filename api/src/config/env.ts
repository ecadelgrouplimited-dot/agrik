import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "8000")),
  corsOrigins: optional("CORS_ORIGIN", "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  databaseUrl: required("DATABASE_URL"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: optional("JWT_EXPIRES_IN", "30d"),
  adminJwtSecret: required("ADMIN_JWT_SECRET"),
  adminJwtExpiresIn: optional("ADMIN_JWT_EXPIRES_IN", "12h"),

  smtp: {
    host: required("SMTP_HOST"),
    port: Number(optional("SMTP_PORT", "465")),
    secure: optional("SMTP_SECURE", "true") === "true",
    user: required("SMTP_USER"),
    pass: required("SMTP_PASS"),
    from: optional("MAIL_FROM", "AGRIK <alerts@agrik.co>"),
  },

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    baseUrl: optional("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    chatModel: optional("DEEPSEEK_CHAT_MODEL", "deepseek-v4-pro"),
    visionModel: optional("DEEPSEEK_VISION_MODEL", "deepseek-v4-flash-vision-exp"),
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    transcribeModel: optional("OPENAI_TRANSCRIBE_MODEL", "whisper-1"),
    ttsModel: optional("OPENAI_TTS_MODEL", "tts-1"),
    ttsVoice: optional("OPENAI_TTS_VOICE", "alloy"),
  },

  uploadDir: optional("UPLOAD_DIR", "./uploads"),
  publicUploadBaseUrl: optional("PUBLIC_UPLOAD_BASE_URL", "http://localhost:8000/uploads"),
};
