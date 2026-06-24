import { assertBotConfig } from "./config.js";
import { registerGuildCommands } from "./bot.js";

assertBotConfig();
const registered = await registerGuildCommands();
const names = registered.map((cmd) => `/${cmd.name}`).join(", ");

console.log(`Registered ${names} for the LT3 server (open to all members).`);
console.log("");
console.log("IMPORTANT — Discord integration overrides:");
console.log("  Do NOT add role overrides on /grid or /gif unless you must.");
console.log("  If you see “Has Overrides”, open each command and REMOVE all role rows.");
console.log("  Let the top-level @everyone + All Channels settings apply instead.");
console.log("");
console.log("If someone still cannot see the commands:");
console.log("  1. Server Settings → Roles → @everyone + Holder → enable “Use Application Commands”");
console.log("  2. Channel + parent category → Holder → enable “Use Application Commands”");
console.log("  3. Run: npm run check-commands");
console.log("  4. Test with a real account — “View Server As Role” often hides slash commands");
