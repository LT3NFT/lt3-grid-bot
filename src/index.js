import { assertBotConfig } from "./config.js";
import { createBotClient, wireBot } from "./bot.js";

assertBotConfig();

const client = createBotClient();
wireBot(client);
await client.login(process.env.DISCORD_TOKEN);
