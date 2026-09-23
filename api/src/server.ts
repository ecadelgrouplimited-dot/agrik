import { createApp } from "./app.js";
import { verifyMailer } from "./lib/mailer.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.port, "127.0.0.1", () => {
  console.log(`AGRIK API listening on 127.0.0.1:${env.port} (${env.nodeEnv})`);
  // Fire and forget: a mail problem is reported, never a reason not to serve.
  void verifyMailer();
});
