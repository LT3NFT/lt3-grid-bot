import { assertBotConfig } from "./config.js";
import { registerGuildCommands } from "./bot.js";

assertBotConfig();
const registered = await registerGuildCommands();
const names = registered.map((cmd) => `/${cmd.name}`).join(", ");

console.log(`Registered ${names} for the LT3 server (open to all members).`);
console.log("");
console.log("If someone still cannot see the commands:");
console.log("  1. Server Settings → Integrations → your bot → /grid & /gif → allow @everyone");
console.log("  2. Channel permissions → @everyone → enable “Use Application Commands”");
