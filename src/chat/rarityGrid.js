import { AttachmentBuilder } from "discord.js";
import { buildGridForTokenIds } from "../grid-service.js";
import { getTopRarestLt3s } from "../nft/rarityRanks.js";
import { runGridJob } from "../util/heavy-queue.js";
import { withTimeout } from "../util/wallet-resolve.js";

const DEFAULT_COUNT = 25;
const MIN_COUNT = 4;
const MAX_COUNT = 36;
const RARITY_GRID_TIMEOUT_MS = 45_000;

/**
 * Natural-language "top N rarest/rarity" grid requests.
 * Matches: top 25 rarest, top 25 rarity, rarest 9, grid of rarest lt3s, etc.
 * @param {string} text
 */
export function isRarityGridRequest(text) {
  const t = text.trim();
  if (!t) return false;
  // Single-token /rarity breakdown — not a collection grid.
  if (/\b(rarity\s+breakdown|\/rarity)\b/i.test(t)) return false;
  if (/\brarity\b/i.test(t) && /\b#\d{1,5}\b/.test(t) && !/\b(top|grid|rarest)\b/i.test(t)) {
    return false;
  }

  const rarityWord = /\b(rarest|rarity|rare)\b/i.test(t);
  const rankingAsk =
    /\b(top|most)\s+\d{1,2}\b/i.test(t) ||
    /\b\d{1,2}\s+(rarest|rarity|rare)\b/i.test(t) ||
    /\b(rarest|rarity)\s+\d{1,2}\b/i.test(t) ||
    /\b(top\s+rarest|most\s+rare(?:st)?)\b/i.test(t);
  const gridAsk = /\b(grid|gridded|collage|mosaic)\b/i.test(t);
  const collectionAsk = /\b(lt3s?|nfts?|ones|pieces)\b/i.test(t);

  if (rankingAsk && rarityWord) return true;
  if (gridAsk && rarityWord) return true;
  if (rarityWord && collectionAsk && /\b(top|most|show|make|pull|send|give|grid)\b/i.test(t)) {
    return true;
  }
  return false;
}

/**
 * @param {string} text
 * @returns {number}
 */
export function parseRarityGridCount(text) {
  const t = text.trim();
  const patterns = [
    /\b(?:top|most)\s+(\d{1,2})\s+(?:rarest|rarity|rare)\b/i,
    /\b(?:rarest|rarity|rare)\s+(\d{1,2})\b/i,
    /\b(\d{1,2})\s+(?:rarest|rarity|rare)\b/i,
    /\btop\s+(\d{1,2})\b/i,
    /\b(\d{1,2})\s*(?:x|×)\s*\1\b/i,
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
  console.log(`[Chat] rarity grid: loading top ${count}`);
  const ranked = await getTopRarestLt3s(count);
  if (ranked.length < MIN_COUNT) {
    throw new Error("Could not load enough rarity ranks for a grid.");
  }

  const tokenIds = ranked.map((r) => r.tokenId);
  const result = await withTimeout(
    buildGridForTokenIds(tokenIds, {
      label: `top-${ranked.length}-rarest`,
    }),
    RARITY_GRID_TIMEOUT_MS,
    "Rarity grid timed out loading images. Try again in a minute."
  );
  const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });
  const caption = pickRarityGridCaption(
    ranked.length,
    ranked[0].rank,
    ranked[ranked.length - 1].rank
  );

  console.log(`[Chat] rarity grid ready: ${result.filename} (${result.buffer.length} bytes)`);
  return { caption, attachment, count: ranked.length, tokenIds };
}

/**
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder }|null>}
 */
export async function buildRarityGridReplyQueued(text, hooks = {}) {
  if (!isRarityGridRequest(text)) return null;
  return runGridJob(() => buildRarityGridReply(text), hooks);
}
