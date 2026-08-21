import { LT3_CONTRACT_LC, OPENSEA_API_KEY } from "../config.js";
import { apiHeaders, fetchJson, resolveCollectionSlug } from "../chat/opensea.js";
import { getNftTokenId } from "./normalize.js";

const TRAIT_INDEX_CACHE = { data: null, at: 0 };
const TRAIT_INDEX_TTL_MS = 60 * 60 * 1000;
const TRAIT_GRID_SIZE = 9;
const MAX_TRAIT_FETCH_PAGES = 8;
const PAGE_LIMIT = 200;

const CATEGORY_HINTS = [
  { re: /\b(headwear|headwear trait|head trait|on (?:their|its) head|hat)\b/i, type: "Headwear" },
  { re: /\b(outfit|clothing|wearing)\b/i, type: "Outfit" },
  { re: /\b(eyes|eye trait)\b/i, type: "Eyes" },
  { re: /\b(mouth)\b/i, type: "Mouth" },
  { re: /\b(base trait|base)\b/i, type: "Base" },
  { re: /\b(background|bg)\b/i, type: "Background" },
];

function normalizeTraitIndex(data) {
  /** @type {Array<{ traitType: string, value: string, count: number }>} */
  const entries = [];

  const counts = data?.counts;
  if (counts && typeof counts === "object") {
    for (const [traitType, values] of Object.entries(counts)) {
      if (!values || typeof values !== "object") continue;
      for (const [value, count] of Object.entries(values)) {
        if (!value) continue;
        entries.push({
          traitType,
          value,
          count: Number(count) || 0,
        });
      }
    }
    if (entries.length) return entries;
  }

  const categories = data?.categories;
  if (categories && typeof categories === "object") {
    for (const [traitType, values] of Object.entries(categories)) {
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        if (!value) continue;
        entries.push({ traitType, value, count: 0 });
      }
    }
  }

  return entries;
}

export async function fetchCollectionTraitIndex() {
  const now = Date.now();
  if (TRAIT_INDEX_CACHE.data && now - TRAIT_INDEX_CACHE.at < TRAIT_INDEX_TTL_MS) {
    return TRAIT_INDEX_CACHE.data;
  }
  if (!OPENSEA_API_KEY) {
    throw new Error("OpenSea API key missing — trait grids need OPENSEA_API_KEY.");
  }

  const slug = await resolveCollectionSlug();
  const data = await fetchJson(`https://api.opensea.io/api/v2/traits/${encodeURIComponent(slug)}`, apiHeaders());
  const entries = normalizeTraitIndex(data);
  if (!entries.length) {
    throw new Error("Could not load LT3 traits from OpenSea.");
  }

  TRAIT_INDEX_CACHE.data = entries;
  TRAIT_INDEX_CACHE.at = now;
  return entries;
}

function hintedTraitType(text) {
  for (const hint of CATEGORY_HINTS) {
    if (hint.re.test(text)) return hint.type;
  }
  return null;
}

function scoreTraitMatch(text, traitType, value) {
  const t = text.toLowerCase();
  const valLc = value.toLowerCase();
  let score = 0;

  if (t.includes(valLc)) {
    score += 120;
  } else {
    const words = valLc.split(/[^a-z0-9]+/i).filter((w) => w.length > 2);
    for (const word of words) {
      if (t.includes(word)) score += 18;
    }
  }

  const hint = hintedTraitType(text);
  if (hint && hint === traitType) score += 25;

  if (traitType.toLowerCase().includes("head") && /\bhead\b/.test(t)) score += 10;

  return score;
}

/**
 * @returns {Promise<{ traitType: string, value: string, count: number }|null>}
 */
export async function resolveTraitFromText(text) {
  const entries = await fetchCollectionTraitIndex();
  const hintType = hintedTraitType(text);

  let best = null;
  let bestScore = 0;

  for (const entry of entries) {
    if (hintType && entry.traitType !== hintType) continue;
    const score = scoreTraitMatch(text, entry.traitType, entry.value);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (!best && hintType) {
    for (const entry of entries) {
      const score = scoreTraitMatch(text, entry.traitType, entry.value);
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }
  }

  if (!best || bestScore < 18) return null;
  return best;
}

export function normalizeOpenSeaNft(nft) {
  const tokenId = nft?.identifier ?? nft?.token_id ?? nft?.tokenId;
  return {
    tokenId,
    identifier: tokenId,
    image_url: nft?.image_url,
    display_image_url: nft?.display_image_url,
    image: nft?.image,
    contract: { address: LT3_CONTRACT_LC },
  };
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * @returns {Promise<object[]>}
 */
export async function fetchNftsByTrait(traitType, traitValue, maxResults = TRAIT_GRID_SIZE + 3) {
  if (!OPENSEA_API_KEY) {
    throw new Error("OpenSea API key missing — trait grids need OPENSEA_API_KEY.");
  }

  const slug = await resolveCollectionSlug();
  const filter = JSON.stringify([{ traitType, value: traitValue }]);
  const collected = [];
  let next = null;
  let pages = 0;

  while (pages < MAX_TRAIT_FETCH_PAGES) {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT), traits: filter });
    if (next) params.set("next", next);
    const url = `https://api.opensea.io/api/v2/collection/${encodeURIComponent(slug)}/nfts?${params}`;
    const data = await fetchJson(url, apiHeaders());
    const batch = Array.isArray(data?.nfts) ? data.nfts : [];

    for (const nft of batch) {
      collected.push(normalizeOpenSeaNft(nft));
    }

    next = typeof data?.next === "string" && data.next.length > 0 ? data.next : null;
    pages += 1;
    if (!next || batch.length === 0) break;
    if (collected.length >= maxResults) break;
  }

  return collected;
}

function dedupeNfts(nfts) {
  const unique = [];
  const seen = new Set();
  for (const nft of nfts) {
    const id = getNftTokenId(nft);
    if (id == null || seen.has(String(id))) continue;
    seen.add(String(id));
    unique.push(nft);
  }
  return unique;
}

const TRAIT_SINGLE_POOL_SIZE = 32;

/**
 * @returns {Promise<object>}
 */
export async function pickRandomNftForTrait(traitType, traitValue) {
  const all = await fetchNftsByTrait(traitType, traitValue, TRAIT_SINGLE_POOL_SIZE);
  const unique = dedupeNfts(all);

  if (!unique.length) {
    throw new Error(`No LT3s match ${traitType}: ${traitValue}.`);
  }

  shuffleInPlace(unique);
  return unique[0];
}

export async function pickRandomNftsForTraitGrid(traitType, traitValue, size = TRAIT_GRID_SIZE) {
  const all = await fetchNftsByTrait(traitType, traitValue, TRAIT_GRID_SIZE + 3);
  const unique = dedupeNfts(all);

  if (unique.length < size) {
    throw new Error(
      `Only ${unique.length} LT3${unique.length === 1 ? "" : "s"} match ${traitType}: ${traitValue}. Need at least ${size} for a 3x3 grid.`
    );
  }

  shuffleInPlace(unique);
  return unique.slice(0, size);
}

export { TRAIT_GRID_SIZE };
