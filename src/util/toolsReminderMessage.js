import { EmbedBuilder, REST, Routes } from "discord.js";
import {
  DISCORD_APPLICATION_ID,
  DISCORD_GUILD_ID,
  DISCORD_TOKEN,
} from "../config.js";

/** Default matches live LT3 sales bot branding when `DISCORD_EMBED_COLOR` is unset. */
const DEFAULT_EMBED_COLOR = 0xd38ea7;

const DEFAULT_COLLECTION_ACTIVITY_URL =
  "https://opensea.io/collection/lessthanthree/activity";

/** @param {string | undefined} raw */
export function parseEmbedColor(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return DEFAULT_EMBED_COLOR;
  const n = trimmed.startsWith("0x") ? Number(trimmed) : Number(trimmed);
  return Number.isFinite(n) ? n : DEFAULT_EMBED_COLOR;
}

function collectionActivityUrl() {
  const fromEnv = String(process.env.OPENSEA_COLLECTION_ACTIVITY_URL || "").trim();
  return fromEnv || DEFAULT_COLLECTION_ACTIVITY_URL;
}

/** Guild slash command name → snowflake id (for </name:id> mentions). */
export async function fetchGuildCommandIdMap() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  /** @type {Array<{ name: string, id: string }>} */
  const commands = await rest.get(
    Routes.applicationGuildCommands(DISCORD_APPLICATION_ID, DISCORD_GUILD_ID)
  );
  return new Map(commands.map((cmd) => [cmd.name, cmd.id]));
}

/**
 * @param {string} name
 * @param {Map<string, string>} idMap
 */
function slashMention(name, idMap) {
  const id = idMap.get(name);
  return id ? `</${name}:${id}>` : `\`/${name}\``;
}

/**
 * @param {{ idMap: Map<string, string> }} opts
 */
export function buildToolsReminderEmbed({ idMap }) {
  const commands = [
    `${slashMention("grid", idMap)} — A grid of your collection.`,
    `${slashMention("gif", idMap)} — A flipbook GIF of your LT3s.`,
    `${slashMention("random", idMap)} — One random LT3 by trait.`,
    `${slashMention("randomgrid", idMap)} — A 3×3 trait grid.`,
    `${slashMention("rarity", idMap)} — A rarity breakdown video of one LT3.`,
  ].join("\n");

  const description = [
    "Beep boop. Quick reminder of what I can do.",
    "",
    commands,
    "",
    "@ me in chat to talk · reply in-thread to keep context.",
  ].join("\n");

  return new EmbedBuilder()
    .setColor(parseEmbedColor(process.env.DISCORD_EMBED_COLOR))
    .setTitle("LT3BOT Tool Check-In 🤖")
    .setURL(collectionActivityUrl())
    .setDescription(description);
}
