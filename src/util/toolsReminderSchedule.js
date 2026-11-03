import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { DISCORD_GUILD_ID } from "../config.js";
import { buildToolsReminderEmbed, fetchGuildCommandIdMap } from "./toolsReminderMessage.js";

const CHANNEL_ID = String(process.env.DISCORD_HUDDLE_CHANNEL_ID || "").trim();
const CHANNEL_NAME = String(process.env.DISCORD_HUDDLE_CHANNEL_NAME || "the-huddle")
  .trim()
  .toLowerCase();
/** 0 / unset = off. */
const INTERVAL_HOURS = Number(process.env.TOOLS_REMINDER_INTERVAL_HOURS) || 0;
const STATE_FILE = path.resolve("data", "tools-reminder.json");

export async function resolveHuddleChannel(client) {
  if (CHANNEL_ID) {
    const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (ch?.isTextBased()) return ch;
    throw new Error(`DISCORD_HUDDLE_CHANNEL_ID=${CHANNEL_ID} is not a text channel the bot can use.`);
  }

  const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
  const channels = await guild.channels.fetch();
  const match = channels.find((ch) => ch?.isTextBased() && ch.name?.toLowerCase() === CHANNEL_NAME);
  if (!match) {
    throw new Error(
      `No text channel named "${CHANNEL_NAME}" in guild ${DISCORD_GUILD_ID}. Set DISCORD_HUDDLE_CHANNEL_ID in .env.`
    );
  }
  return match;
}

export async function postToolsReminder(client) {
  const channel = await resolveHuddleChannel(client);
  const idMap = await fetchGuildCommandIdMap();
  const sent = await channel.send({ embeds: [buildToolsReminderEmbed({ idMap })] });
  return { channel, sent };
}

async function readLastPostedAt() {
  try {
    const data = JSON.parse(await readFile(STATE_FILE, "utf8"));
    return Number(data.lastPostedAt) || 0;
  } catch {
    return 0;
  }
}

async function writeLastPostedAt(at) {
  await mkdir(path.dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify({ lastPostedAt: at }));
}

/** Posts the tools reminder every TOOLS_REMINDER_INTERVAL_HOURS; survives restarts without double-posting. */
export async function startToolsReminderSchedule(client) {
  if (INTERVAL_HOURS <= 0) return;
  const intervalMs = INTERVAL_HOURS * 60 * 60 * 1000;

  const tick = async () => {
    try {
      const { channel } = await postToolsReminder(client);
      await writeLastPostedAt(Date.now());
      console.log(`[tools-reminder] posted to #${channel.name}`);
    } catch (err) {
      console.error("[tools-reminder] post failed", err);
    }
    setTimeout(tick, intervalMs).unref?.();
  };

  const lastPostedAt = await readLastPostedAt();
  // First run waits a full interval, so turning this on never surprises the channel.
  if (!lastPostedAt) await writeLastPostedAt(Date.now());
  const since = lastPostedAt ? Date.now() - lastPostedAt : 0;
  const firstDelay = Math.max(60_000, intervalMs - since);
  console.log(
    `[tools-reminder] every ${INTERVAL_HOURS}h — next post in ${(firstDelay / 3_600_000).toFixed(1)}h`
  );
  setTimeout(tick, firstDelay).unref?.();
}
