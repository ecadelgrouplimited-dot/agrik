import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRouter from "./modules/auth/router.js";
import adminAuthRouter from "./modules/admin/auth.js";
import adminRouter from "./modules/admin/router.js";
import marketRouter from "./modules/market/router.js";
import referenceRouter from "./modules/reference/router.js";
import profileRouter from "./modules/profile/router.js";
import chatRouter from "./modules/chat/router.js";
import weatherRouter from "./modules/weather/router.js";

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", express.static(env.uploadDir));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/auth", authRouter);
  app.use("/admin", adminAuthRouter);
  app.use("/admin", adminRouter);
  app.use("/market", marketRouter);
  app.use("/reference", referenceRouter);
  app.use("/profile", profileRouter);
  app.use("/chat", chatRouter);
  app.use("/weather", weatherRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
