import { LT3_CONTRACT_LC, OPENSEA_API_KEY } from "../config.js";

const SLUG_CACHE = { slug: null, at: 0 };
const FLOOR_CACHE = { text: null, at: 0 };
const CACHE_MS = 60_000;

async function fetchJson(url, headers) {
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
  if (!resp.ok) throw new Error(`OpenSea ${resp.status}`);
  return resp.json();
}

async function resolveCollectionSlug() {
  const now = Date.now();
  if (SLUG_CACHE.slug && now - SLUG_CACHE.at < 3600_000) return SLUG_CACHE.slug;
  if (!OPENSEA_API_KEY) return null;

  const url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${LT3_CONTRACT_LC}/nfts?limit=1`;
  const data = await fetchJson(url, { "x-api-key": OPENSEA_API_KEY });
  const slug = data?.nfts?.[0]?.collection;
  if (typeof slug === "string" && slug.length > 0) {
    SLUG_CACHE.slug = slug;
    SLUG_CACHE.at = now;
    return slug;
  }
  return null;
}

function formatEth(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const eth = n >= 1e12 ? n / 1e18 : n;
  const rounded = eth >= 1 ? eth.toFixed(3) : eth.toFixed(4);
  return rounded.replace(/\.?0+$/, "") || eth.toFixed(4);
}

/** @returns {Promise<string|null>} */
export async function fetchLt3FloorReply() {
  const now = Date.now();
  if (FLOOR_CACHE.text && now - FLOOR_CACHE.at < CACHE_MS) return FLOOR_CACHE.text;
  if (!OPENSEA_API_KEY) return "No floor feed wired. Check OpenSea for live data.";

  try {
    const slug = await resolveCollectionSlug();
    if (!slug) return "Couldn't resolve the collection slug right now.";

    const url = `https://api.opensea.io/api/v2/collections/${encodeURIComponent(slug)}/stats`;
    const data = await fetchJson(url, { "x-api-key": OPENSEA_API_KEY });
    const floorRaw =
      data?.total?.floor_price ??
      data?.intervals?.[0]?.floor_price ??
      data?.floor_price;
    const eth = formatEth(floorRaw);
    if (!eth) return "Floor data came back empty. Try again in a minute.";

    const reply = `LT3 floor sits around ${eth} ETH on OpenSea right now.`;
    FLOOR_CACHE.text = reply;
    FLOOR_CACHE.at = now;
    return reply;
  } catch {
    return "Floor pull failed. OpenSea might be sleeping.";
  }
}
