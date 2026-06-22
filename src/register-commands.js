import { assertBotConfig } from "./config.js";
import { registerGuildCommands } from "./bot.js";

assertBotConfig();
await registerGuildCommands();
console.log("Registered /grid slash command for LT3 guild.");
