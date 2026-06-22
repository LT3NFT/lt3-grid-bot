import { assertBotConfig } from "./config.js";
import { createBotClient, wireBot } from "./bot.js";

assertBotConfig();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception", err);
});

const client = createBotClient();
wireBot(client);
await client.login(process.env.DISCORD_TOKEN);
