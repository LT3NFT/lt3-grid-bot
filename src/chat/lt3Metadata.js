import { LT3_CONTRACT_LC, OPENSEA_API_KEY } from "../config.js";
import { apiHeaders, fetchJson } from "./opensea.js";

const CACHE = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE = 200;

/** @param {string} text */
export function extractTokenId(text) {
  if (!text) return null;
  const patterns = [
    /\blt3\s*#?\s*(\d{1,4})\b/i,
    /#\s*(\d{1,4})\b/,
    /\btoken\s*(?:id\s*)?#?\s*(\d{1,4})\b/i,
    /\b(?:number|no\.?)\s*(\d{1,4})\b/i,
  ];
  for (const re of patterns) {
    const match = text.match(re);
    if (match) return match[1];
  }
  return null;
}

/** @param {unknown} data */
export function parseTraitsFromMetadata(data) {
  const raw = data?.traits ?? data?.attributes ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((trait) => ({
      type: String(trait?.trait_type ?? trait?.traitType ?? "").trim(),
      value: String(trait?.value ?? "").trim(),
    }))
    .filter((trait) => trait.type && trait.value);
}

/**
 * @param {string} tokenId
 * @returns {Promise<{ tokenId: string, name: string|null, traits: Array<{ type: string, value: string }>, imageUrl: string|null }|null>}
 */
export async function fetchLt3TokenMetadata(tokenId) {
  if (!OPENSEA_API_KEY || !tokenId) return null;

  const key = `${LT3_CONTRACT_LC}:${tokenId}`;
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  try {
    const url = `https://api.opensea.io/api/v2/metadata/ethereum/${LT3_CONTRACT_LC}/${tokenId}`;
    const data = await fetchJson(url, apiHeaders());
    const traits = parseTraitsFromMetadata(data);
    const result = {
      tokenId: String(tokenId),
      name: typeof data?.name === "string" ? data.name : null,
      traits,
      imageUrl: typeof data?.image === "string" && data.image.length > 0 ? data.image : null,
    };
    if (CACHE.size >= MAX_CACHE) {
      const first = CACHE.keys().next().value;
      if (first) CACHE.delete(first);
    }
    CACHE.set(key, { data: result, at: Date.now() });
    return result;
  } catch (err) {
    console.warn("[Chat] LT3 metadata fetch failed", tokenId, err?.message || err);
    return null;
  }
}

/**
 * @param {{ tokenId: string, name?: string|null, traits?: Array<{ type: string, value: string }> }|null} metadata
 */
export function formatMetadataForPrompt(metadata) {
  if (!metadata?.traits?.length) return "";
  const lines = metadata.traits.map((t) => `- ${t.type}: ${t.value}`);
  const label = metadata.name || `LT3 #${metadata.tokenId}`;
  return `\n\nOfficial metadata for ${label}:\n${lines.join("\n")}\nUse these exact trait names. Still describe colors and mood from what you see in the image.`;
}
