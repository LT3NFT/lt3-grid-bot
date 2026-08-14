import { LT3_CONTRACT_LC, OPENSEA_API_KEY } from "../config.js";

/** Known LT3 slug on OpenSea — fallback if contract lookup fails. */
export const LT3_COLLECTION_SLUG = "lessthanthree";

const SLUG_CACHE = { slug: null, at: 0 };

export async function fetchJson(url, headers = {}) {
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
  if (!resp.ok) throw new Error(`OpenSea ${resp.status}`);
  return resp.json();
}

export function apiHeaders() {
  return OPENSEA_API_KEY ? { "x-api-key": OPENSEA_API_KEY } : {};
}

export async function resolveCollectionSlug() {
  const now = Date.now();
  if (SLUG_CACHE.slug && now - SLUG_CACHE.at < 3600_000) return SLUG_CACHE.slug;
  if (!OPENSEA_API_KEY) return LT3_COLLECTION_SLUG;

  try {
    const url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${LT3_CONTRACT_LC}/nfts?limit=1`;
    const data = await fetchJson(url, apiHeaders());
    const slug = data?.nfts?.[0]?.collection;
    if (typeof slug === "string" && slug.length > 0) {
      SLUG_CACHE.slug = slug;
      SLUG_CACHE.at = now;
      return slug;
    }
  } catch {
    // fall through
  }
  return LT3_COLLECTION_SLUG;
}

export function formatEth(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const eth = n >= 1e12 ? n / 1e18 : n;
  const rounded = eth >= 1 ? eth.toFixed(3) : eth.toFixed(4);
  return rounded.replace(/\.?0+$/, "") || eth.toFixed(4);
}

export function formatCount(n) {
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toLocaleString("en-US");
}
