import os from "os";
import sharp from "sharp";
import { assertBotConfig, BOT_VERSION } from "./config.js";
import { createBotClient, wireBot } from "./bot.js";

assertBotConfig();

const sharpConcurrency = Number(process.env.SHARP_CONCURRENCY) || Math.min(2, os.cpus().length || 2);
sharp.concurrency(sharpConcurrency);
sharp.cache({ memory: 32, files: 0 });

console.log(`lt3-grid-bot ${BOT_VERSION} (sharp concurrency ${sharpConcurrency})`);

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception", err);
});

setInterval(() => {
  const m = process.memoryUsage();
  console.log(
    `[Heartbeat] rss=${Math.round(m.rss / 1024 / 1024)}MB heap=${Math.round(m.heapUsed / 1024 / 1024)}MB uptime=${Math.round(process.uptime())}s`
  );
}, 60_000);

const client = createBotClient();
wireBot(client);
await client.login(process.env.DISCORD_TOKEN);
