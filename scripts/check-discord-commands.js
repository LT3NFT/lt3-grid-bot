import { REST, Routes } from "discord.js";
import {
  assertBotConfig,
  BOT_VERSION,
  DISCORD_APPLICATION_ID,
  DISCORD_GUILD_ID,
  DISCORD_TOKEN,
} from "../src/config.js";

assertBotConfig();

const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

const [globalCommands, guildCommands, guild] = await Promise.all([
  rest.get(Routes.applicationCommands(DISCORD_APPLICATION_ID)),
  rest.get(Routes.applicationGuildCommands(DISCORD_APPLICATION_ID, DISCORD_GUILD_ID)),
  rest.get(Routes.guild(DISCORD_GUILD_ID)).catch(() => null),
]);

console.log(`lt3-grid-bot ${BOT_VERSION}`);
console.log(`Application ID: ${DISCORD_APPLICATION_ID}`);
console.log(`Guild ID: ${DISCORD_GUILD_ID}${guild ? ` (${guild.name})` : " (could not fetch guild — check ID)"}`);
console.log("");

console.log(`Global commands (${globalCommands.length}):`);
if (globalCommands.length === 0) {
  console.log("  (none — good, guild-only registration)");
} else {
  for (const cmd of globalCommands) {
    console.log(`  /${cmd.name} — perms=${cmd.default_member_permissions ?? "everyone"}`);
  }
}

console.log("");
console.log(`Guild commands (${guildCommands.length}):`);
if (guildCommands.length === 0) {
  console.log("  NONE REGISTERED — run: npm run register-commands");
} else {
  for (const cmd of guildCommands) {
    const perms = cmd.default_member_permissions ?? "everyone";
    const contexts = cmd.contexts?.join(",") ?? "default";
    const integration = cmd.integration_types?.join(",") ?? "default";
    console.log(`  /${cmd.name} id=${cmd.id}`);
    console.log(`    default_member_permissions=${perms}`);
    console.log(`    contexts=${contexts} integration_types=${integration}`);
  }
}

console.log("");
console.log("If commands exist here but members cannot see them:");
console.log("  1. REMOVE per-command overrides on /grid & /gif (Integrations → command → clear overrides)");
console.log("  2. Server Settings → Roles → @everyone AND Holder → enable “Use Application Commands”");
console.log("  3. Channel (and parent category) → Holder → enable “Use Application Commands”");
console.log("  4. “View Server As Role” often hides slash commands — test with a real member account");
