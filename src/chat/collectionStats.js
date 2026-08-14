import {
  apiHeaders,
  fetchJson,
  formatCount,
  formatEth,
  LT3_COLLECTION_SLUG,
  resolveCollectionSlug,
} from "./opensea.js";
import { OPENSEA_API_KEY } from "../config.js";

const STATS_CACHE = { data: null, at: 0 };
const CACHE_MS = 90_000;
const LISTED_CACHE_MS = 120_000;
const MAX_LISTING_PAGES = 30;

/** @typedef {{ floorEth: string|null, numOwners: number|null, sales: number|null, volume: string|null, totalSupply: number|null, listedCount: number|null, slug: string }} Lt3Stats */

async function fetchListedCount(slug) {
  const seen = new Set();
  let next = null;
  let pages = 0;

  while (pages < MAX_LISTING_PAGES) {
    const params = new URLSearchParams({ limit: "200" });
    if (next) params.set("next", next);
    const url = `https://api.opensea.io/api/v2/listings/collection/${encodeURIComponent(slug)}/all?${params}`;
    const data = await fetchJson(url, apiHeaders());
    const batch = Array.isArray(data?.listings) ? data.listings : [];

    for (const row of batch) {
      if (row?.status !== "ACTIVE") continue;
      const id =
        row?.asset?.identifier ??
        row?.protocol_data?.parameters?.offer?.[0]?.identifierOrCriteria;
      if (id != null && String(id).length > 0) seen.add(String(id));
    }

    next = typeof data?.next === "string" && data.next.length > 0 ? data.next : null;
    pages += 1;
    if (!next || batch.length === 0) break;
  }

  return seen.size;
}

/** @returns {Promise<Lt3Stats|null>} */
export async function fetchLt3CollectionStats({ needListed = false } = {}) {
  const now = Date.now();
  const cached = STATS_CACHE.data;
  const listedFresh =
    !needListed || (cached?.listedCount != null && now - STATS_CACHE.at < LISTED_CACHE_MS);
  if (cached && now - STATS_CACHE.at < CACHE_MS && listedFresh) return cached;

  if (!OPENSEA_API_KEY) return null;

  try {
    const slug = await resolveCollectionSlug();
    const headers = apiHeaders();

    const [statsData, collectionData] = await Promise.all([
      fetchJson(`https://api.opensea.io/api/v2/collections/${encodeURIComponent(slug)}/stats`, headers),
      fetchJson(`https://api.opensea.io/api/v2/collections/${encodeURIComponent(slug)}`, headers).catch(
        () => null
      ),
    ]);

    const total = statsData?.total ?? {};
    let listedCount = cached?.listedCount ?? null;
    if (needListed && (!listedFresh || listedCount == null)) {
      try {
        listedCount = await fetchListedCount(slug);
      } catch (err) {
        console.error("[Chat] listed count failed", err);
        listedCount = null;
      }
    }

    /** @type {Lt3Stats} */
    const data = {
      slug,
      floorEth: formatEth(total.floor_price),
      numOwners: Number.isFinite(total.num_owners) ? total.num_owners : null,
      sales: Number.isFinite(total.sales) ? total.sales : null,
      volume: Number.isFinite(total.volume) ? total.volume.toFixed(1) : null,
      totalSupply: Number.isFinite(collectionData?.total_supply)
        ? collectionData.total_supply
        : 5555,
      listedCount,
    };

    STATS_CACHE.data = data;
    STATS_CACHE.at = now;
    return data;
  } catch (err) {
    console.error("[Chat] collection stats failed", err);
    return null;
  }
}

const LISTED_RE =
  /\b(how many|number of|count of|how much)?\s*(are\s+)?(listed|listings|listing|listing count|on opensea|for sale|on the market|on market|available to buy|on sale)\b/i;
const OWNERS_RE = /\b(how many|number of)?\s*(owners|holders|people holding|unique owners)\b/i;
const SUPPLY_RE = /\b(total supply|collection size|how many nfts)\b/i;
const SUPPLY_LT3_RE =
  /\bhow many lt3s?\b(?!.*\b(listed|listings|listing|for sale|on opensea|on the market|on sale)\b)/i;
const VOLUME_RE = /\b(volume|total volume|sales count|how many sales)\b/i;
const FLOOR_IN_TEXT_RE = /\b(floor(?:\s*price)?|fp)\b/i;

function wantsListed(text) {
  return LISTED_RE.test(text);
}

function wantsOwners(text) {
  return OWNERS_RE.test(text);
}

function wantsSupply(text) {
  return SUPPLY_RE.test(text) || SUPPLY_LT3_RE.test(text);
}

export function isCollectionStatsQuestion(text) {
  const t = text.trim();
  if (!t) return false;
  return (
    wantsListed(t) ||
    wantsFloor(t) ||
    wantsOwners(t) ||
    wantsSupply(t) ||
    wantsVolume(t) ||
    /\b(collection stats|market stats|stats|on opensea|for sale|on the market)\b/i.test(t)
  );
}

function wantsVolume(text) {
  return VOLUME_RE.test(text);
}

function wantsFloor(text) {
  return FLOOR_IN_TEXT_RE.test(text);
}

/** @returns {Promise<string>} */
export async function fetchLt3StatsReply(userText) {
  const question = userText.trim();
  const listedQuestion = wantsListed(question);
  const floorQuestion = wantsFloor(question);
  const ownersQuestion = wantsOwners(question);
  const supplyQuestion = wantsSupply(question);
  const volumeQuestion = wantsVolume(question);
  const generalStats = /\b(stats|market)\b/i.test(question);

  const stats = await fetchLt3CollectionStats({ needListed: listedQuestion || generalStats });

  if (!stats) {
    return "No live stats feed wired. Need OpenSea API key on the bot.";
  }

  const onlyListed =
    listedQuestion && !floorQuestion && !ownersQuestion && !supplyQuestion && !volumeQuestion;

  if (onlyListed) {
    if (stats.listedCount == null) {
      return "Couldn't pull live listing count. Check OpenSea API key on the bot.";
    }
    return `${formatCount(stats.listedCount)} LT3s listed on OpenSea right now.`;
  }

  const parts = [];

  if (floorQuestion) {
    if (!stats.floorEth) return "Floor data came back empty. Try again in a minute.";
    parts.push(`Floor sits around ${stats.floorEth} ETH`);
  }

  if (listedQuestion && stats.listedCount != null) {
    parts.push(`${formatCount(stats.listedCount)} listed`);
  }

  if (ownersQuestion && stats.numOwners != null) {
    parts.push(`${formatCount(stats.numOwners)} owners`);
  }

  if (supplyQuestion && stats.totalSupply != null) {
    parts.push(`${formatCount(stats.totalSupply)} total supply`);
  }

  if (volumeQuestion) {
    if (stats.volume != null) parts.push(`${stats.volume} ETH volume`);
    if (stats.sales != null) parts.push(`${formatCount(stats.sales)} sales`);
  }

  if (parts.length === 0) {
    const overview = [];
    if (stats.listedCount != null) overview.push(`${formatCount(stats.listedCount)} listed`);
    if (stats.floorEth) overview.push(`floor ${stats.floorEth} ETH`);
    if (stats.numOwners != null) overview.push(`${formatCount(stats.numOwners)} owners`);
    if (stats.totalSupply != null) overview.push(`${formatCount(stats.totalSupply)} supply`);
    if (overview.length === 0) return "Stats came back empty. Try again in a minute.";
    return `LT3 on OpenSea: ${overview.join(", ")}.`;
  }

  return `LT3 on OpenSea: ${parts.join(". ")}.`;
}

/** Back-compat for floor-only trigger. */
export async function fetchLt3FloorReply() {
  return fetchLt3StatsReply("floor price");
}

export { wantsListed, wantsFloor, LISTED_RE, FLOOR_IN_TEXT_RE };
