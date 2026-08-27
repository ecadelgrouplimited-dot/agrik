import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.port, "127.0.0.1", () => {
  console.log(`AGRIK API listening on 127.0.0.1:${env.port} (${env.nodeEnv})`);
});
