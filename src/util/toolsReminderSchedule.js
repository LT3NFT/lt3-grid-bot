import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { DISCORD_GUILD_ID } from "../config.js";
import { buildToolsReminderEmbed, fetchGuildCommandIdMap } from "./toolsReminderMessage.js";

const CHANNEL_ID = String(process.env.DISCORD_TOOLS_REMINDER_CHANNEL_ID || "").trim();
const CHANNEL_NAME = String(process.env.DISCORD_TOOLS_REMINDER_CHANNEL_NAME || "main-chat")
  .trim()
  .toLowerCase();
/**
 * Hours between posts. Default 36. Set TOOLS_REMINDER_INTERVAL_HOURS=0 to disable.
 * Fractional values work (e.g. 0.1 for testing).
 */
const INTERVAL_HOURS = (() => {
  const raw = process.env.TOOLS_REMINDER_INTERVAL_HOURS;
  if (raw === undefined || raw === "") return 36;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 36;
})();
const STATE_FILE = path.resolve("data", "tools-reminder.json");

/** Strip emoji/punctuation so "📮 | main-chat" matches "main-chat". */
function normalizeChannelName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function channelMatches(channelName, target) {
  const raw = String(channelName || "").toLowerCase();
  const want = String(target || "").toLowerCase();
  if (!want) return false;
  if (raw === want) return true;
  if (raw.endsWith(want) || raw.includes(want)) return true;

  const norm = normalizeChannelName(channelName);
  const wantNorm = normalizeChannelName(target);
  if (norm === wantNorm) return true;
  if (norm.endsWith(wantNorm) || norm.includes(wantNorm)) return true;
  // "mailbox-main-chat" / "main-chat" after emoji stripped to trailing slug
  const parts = norm.split("-").filter(Boolean);
  return parts[parts.length - 1] === wantNorm || parts.slice(-2).join("-") === wantNorm;
}

export async function resolveToolsReminderChannel(client) {
  if (CHANNEL_ID) {
    const ch = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (ch?.isTextBased()) return ch;
    throw new Error(
      `DISCORD_TOOLS_REMINDER_CHANNEL_ID=${CHANNEL_ID} is not a text channel the bot can use.`
    );
  }

  const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
  const channels = await guild.channels.fetch();
  const textChannels = [...channels.values()].filter((ch) => ch?.isTextBased());
  const match = textChannels.find((ch) => channelMatches(ch.name, CHANNEL_NAME));
  if (!match) {
    const sample = textChannels
      .map((ch) => ch.name)
      .filter((n) => /main|chat|huddle/i.test(n))
      .slice(0, 8)
      .join(", ");
    throw new Error(
      `No text channel matching "${CHANNEL_NAME}" in guild ${DISCORD_GUILD_ID}.` +
        (sample ? ` Nearby names: ${sample}.` : "") +
        ` If #main-chat is private, give LT3BOT View Channel + Send Messages, or set DISCORD_TOOLS_REMINDER_CHANNEL_ID.`
    );
  }
  return match;
}

/** @deprecated use resolveToolsReminderChannel */
export const resolveHuddleChannel = resolveToolsReminderChannel;

export async function postToolsReminder(client) {
  const channel = await resolveToolsReminderChannel(client);
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
  // First-ever post: ~2 minutes after boot so you can confirm it in the channel.
  // After that: every INTERVAL_HOURS from the last successful send (survives restarts).
  const firstDelay = !lastPostedAt
    ? 120_000
    : Math.max(60_000, intervalMs - (Date.now() - lastPostedAt));
  const delayLabel =
    firstDelay >= 3_600_000
      ? `${(firstDelay / 3_600_000).toFixed(1)}h`
      : `${Math.round(firstDelay / 60_000)}m`;
  console.log(
    `[tools-reminder] every ${INTERVAL_HOURS}h → match "${CHANNEL_NAME || CHANNEL_ID}" — next post in ${delayLabel}`
  );
  setTimeout(tick, firstDelay).unref?.();
}
