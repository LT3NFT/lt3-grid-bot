import { assertBotConfig, BOT_VERSION } from "./config.js";
import { createBotClient, wireBot } from "./bot.js";

assertBotConfig();
console.log(`lt3-grid-bot ${BOT_VERSION}`);

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception", err);
});

const client = createBotClient();
wireBot(client);
await client.login(process.env.DISCORD_TOKEN);
