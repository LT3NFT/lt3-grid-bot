/** OpenSea-aligned LT3 rarity ranks from the lt3tools snapshot (same source as /rarity). */

const RARITY_SNAPSHOT_URL = "https://lt3tools.com/tools/assets/lt3-rarity.json";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const LT3_SUPPLY = 5555;

/** @type {{ at: number, ranks: number[] }|null} */
let cache = null;
/** @type {Promise<number[]>|null} */
let inflight = null;

/**
 * ranks[i] = OpenRarity rank for token id i+1 (1 = rarest). Ties allowed.
 * @returns {Promise<number[]>}
 */
export async function loadLt3RarityRanks() {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS && cache.ranks.length === LT3_SUPPLY) {
    return cache.ranks;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    const res = await fetch(RARITY_SNAPSHOT_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      throw new Error(`Could not load LT3 rarity ranks (${res.status}).`);
    }
    const data = await res.json();
    const ranks = Array.isArray(data?.ranks) ? data.ranks.map((n) => Number(n)) : [];
    if (ranks.length !== LT3_SUPPLY || ranks.some((n) => !Number.isFinite(n) || n < 1)) {
      throw new Error("LT3 rarity snapshot looked incomplete.");
    }
    cache = { at: Date.now(), ranks };
    return ranks;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Top N rarest token ids (lowest rank first). Ties break by lower token id.
 * @param {number} count
 * @returns {Promise<Array<{ tokenId: string, rank: number }>>}
 */
export async function getTopRarestLt3s(count) {
  const n = Math.max(1, Math.min(Math.floor(count), LT3_SUPPLY));
  const ranks = await loadLt3RarityRanks();
  const indexed = ranks.map((rank, i) => ({ tokenId: String(i + 1), rank }));
  indexed.sort((a, b) => a.rank - b.rank || Number(a.tokenId) - Number(b.tokenId));
  return indexed.slice(0, n);
}

/** @internal test helper */
export function _resetRarityRankCacheForTests() {
  cache = null;
  inflight = null;
}
