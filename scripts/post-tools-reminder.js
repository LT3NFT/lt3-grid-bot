import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import {
  assertBotConfig,
  DISCORD_GUILD_ID,
  DISCORD_TOKEN,
} from "../src/config.js";
import { TOOLS_REMINDER_MESSAGE } from "../src/util/toolsReminderMessage.js";

const CHANNEL_ID = String(process.env.DISCORD_HUDDLE_CHANNEL_ID || "").trim();
const CHANNEL_NAME = String(process.env.DISCORD_HUDDLE_CHANNEL_NAME || "thehuddle")
  .trim()
  .toLowerCase();

async function resolveHuddleChannel(client) {
  if (CHANNEL_ID) {
    const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (ch?.isTextBased()) return ch;
    throw new Error(`DISCORD_HUDDLE_CHANNEL_ID=${CHANNEL_ID} is not a text channel the bot can use.`);
  }

  const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
  const channels = await guild.channels.fetch();
  const match = channels.find(
    (ch) => ch?.isTextBased() && ch.name?.toLowerCase() === CHANNEL_NAME
  );
  if (!match) {
    throw new Error(
      `No text channel named "${CHANNEL_NAME}" in guild ${DISCORD_GUILD_ID}. Set DISCORD_HUDDLE_CHANNEL_ID in .env.`
    );
  }
  return match;
}

async function main() {
  assertBotConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(DISCORD_TOKEN);

  try {
    const channel = await resolveHuddleChannel(client);
    const sent = await channel.send(TOOLS_REMINDER_MESSAGE);
    console.log(`Posted tools reminder to #${channel.name} (${channel.id}) — message ${sent.id}`);
  } finally {
    await client.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
