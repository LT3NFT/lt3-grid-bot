import { AttachmentBuilder } from "discord.js";
import { buildGridForTokenIds } from "../grid-service.js";
import { getTopRarestLt3s } from "../nft/rarityRanks.js";
import { runGridJob } from "../util/heavy-queue.js";

const DEFAULT_COUNT = 25;
const MIN_COUNT = 4;
const MAX_COUNT = 49;

/**
 * Natural-language "top N rarest" / "rarest grid" requests.
 * @param {string} text
 */
export function isRarityGridRequest(text) {
  const t = text.trim();
  if (!t) return false;
  if (/\b(rarity\s+breakdown|\/rarity)\b/i.test(t)) return false;
  if (/\b(top|most)\s+\d{1,2}\s+rarest\b/i.test(t)) return true;
  if (/\brarest\s+\d{1,2}\b/i.test(t)) return true;
  if (/\b\d{1,2}\s+rarest\b/i.test(t)) return true;
  if (/\b(top\s+rarest|rarest\s+lt3s?|most\s+rare(?:st)?\s+lt3s?)\b/i.test(t)) return true;
  if (/\bgrid\b/i.test(t) && /\brarest\b/i.test(t)) return true;
  return false;
}

/**
 * @param {string} text
 * @returns {number}
 */
export function parseRarityGridCount(text) {
  const t = text.trim();
  const patterns = [
    /\b(?:top|most)\s+(\d{1,2})\s+rarest\b/i,
    /\brarest\s+(\d{1,2})\b/i,
    /\b(\d{1,2})\s+rarest\b/i,
    /\btop\s+(\d{1,2})\b/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) return Math.max(MIN_COUNT, Math.min(MAX_COUNT, n));
    }
  }
  return DEFAULT_COUNT;
}

function pickRarityGridCaption(count, topRank, bottomRank) {
  if (topRank === bottomRank) {
    return `Top ${count} rarest LT3s. OpenSea rank ${topRank}.`;
  }
  return `Top ${count} rarest LT3s. OpenSea ranks ${topRank}-${bottomRank}.`;
}

/**
 * @param {string} text
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder, count: number, tokenIds: string[] }|null>}
 */
export async function buildRarityGridReply(text) {
  if (!isRarityGridRequest(text)) return null;

  const count = parseRarityGridCount(text);
  const ranked = await getTopRarestLt3s(count);
  if (ranked.length < MIN_COUNT) {
    throw new Error("Could not load enough rarity ranks for a grid.");
  }

  const tokenIds = ranked.map((r) => r.tokenId);
  const result = await buildGridForTokenIds(tokenIds, {
    label: `top-${ranked.length}-rarest`,
  });
  const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });
  const caption = pickRarityGridCaption(
    ranked.length,
    ranked[0].rank,
    ranked[ranked.length - 1].rank
  );

  return { caption, attachment, count: ranked.length, tokenIds };
}

/**
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder }|null>}
 */
export async function buildRarityGridReplyQueued(text, hooks = {}) {
  if (!isRarityGridRequest(text)) return null;
  return runGridJob(() => buildRarityGridReply(text), hooks);
}
