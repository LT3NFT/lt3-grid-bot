import sharp from "sharp";
import { LT3_ALCHEMY_KEY, LT3_CONTRACT_LC } from "../config.js";
import {
  expandImageUrlCandidates,
  getNftContractAddressLc,
  getNftImageUrlCandidates,
  getNftTokenId,
} from "./normalize.js";

function isCdnUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("alchemy.com") || host.includes("cloudinary.com");
  } catch {
    return false;
  }
}

function rankImageUrls(urls) {
  function score(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes("nft2-cdn.alchemy.com")) return 0;
      if (host.includes("cloudinary.com") && url.includes("convert-png")) return 1;
      if (host.includes("cloudinary.com")) return 2;
      if (host === "ipfs.io") return 4;
      if (host.includes("pinata")) return 5;
      if (host === "dweb.link") return 6;
      return 3;
    } catch {
      return 99;
    }
  }

  return [...urls].sort((a, b) => score(a) - score(b));
}

async function fetchImageBuffer(url, timeoutMs) {
  const res = await fetch(url, {
    headers: { Accept: "image/*,*/*" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Image fetch failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function urlsForAttempt(nft, options) {
  const ranked = rankImageUrls(expandImageUrlCandidates(getNftImageUrlCandidates(nft)));
  if (options.preferCdn) {
    const cdn = ranked.filter(isCdnUrl);
    if (cdn.length) return cdn;
  }
  return ranked;
}

function timeoutForUrl(url, preferCdn) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("ipfs") || host === "dweb.link" || host.includes("pinata")) {
      return preferCdn ? 10_000 : 20_000;
    }
  } catch {
    // ignore
  }
  return preferCdn ? 8_000 : 12_000;
}

async function loadImageFromUrl(url, displayName, timeoutMs, maxLongEdge = 1200) {
  const buffer = await fetchImageBuffer(url, timeoutMs);
  const { data, info } = await sharp(buffer)
    .resize(maxLongEdge, maxLongEdge, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });

  return {
    name: displayName,
    width: info.width || 1,
    height: info.height || 1,
    buffer: data,
  };
}

async function tryLoadFromUrl(url, displayName, maxLongEdge, preferCdn) {
  const timeoutMs = timeoutForUrl(url, preferCdn);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await loadImageFromUrl(url, displayName, timeoutMs, maxLongEdge);
    } catch (err) {
      if (attempt === 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, preferCdn ? 100 : 400));
    }
  }
  throw new Error("Unreachable");
}

async function fetchNftMetadata(nft) {
  if (!LT3_ALCHEMY_KEY) return null;
  const contract = getNftContractAddressLc(nft) || LT3_CONTRACT_LC;
  const tokenId = getNftTokenId(nft);
  if (!tokenId) return null;

  const url = new URL(
    `https://eth-mainnet.g.alchemy.com/nft/v3/${encodeURIComponent(LT3_ALCHEMY_KEY)}/getNFTMetadata`
  );
  url.searchParams.set("contractAddress", contract);
  url.searchParams.set("tokenId", String(tokenId));

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  return res.json();
}

async function createPlaceholderImage(displayName) {
  const size = 512;
  const buffer = await sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 40, g: 40, b: 44 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();

  console.warn(`Using placeholder image for ${displayName}`);
  return {
    name: displayName,
    width: size,
    height: size,
    buffer,
  };
}

async function tryUrlsForNft(nft, displayName, options) {
  const urls = urlsForAttempt(nft, options);
  const maxAttempts = options.maxUrlAttempts ?? 10;
  for (const url of urls.slice(0, maxAttempts)) {
    try {
      return await tryLoadFromUrl(url, displayName, options.maxLongEdge ?? 1200, options.preferCdn);
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function loadBestImageForNft(nft, displayName, options) {
  let image = await tryUrlsForNft(nft, displayName, options);
  if (image) return image;

  if (options.skipMetadataRefresh) {
    return createPlaceholderImage(displayName);
  }

  const refreshed = await fetchNftMetadata(nft);
  if (refreshed) {
    image = await tryUrlsForNft(refreshed, displayName, {
      ...options,
      preferCdn: false,
      maxUrlAttempts: 10,
    });
    if (image) return image;
  }

  return createPlaceholderImage(displayName);
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index;
      index += 1;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function loadNftImages(nfts, options = {}) {
  const concurrency = options.concurrency ?? 8;
  const loadOptions = {
    maxLongEdge: options.maxLongEdge ?? 1200,
    maxUrlAttempts: options.maxUrlAttempts ?? 10,
    preferCdn: options.preferCdn ?? false,
    skipMetadataRefresh: options.skipMetadataRefresh ?? false,
  };

  return mapWithConcurrency(nfts, concurrency, async (nft) => {
    const tokenId = getNftTokenId(nft) ?? "?";
    const displayName = `LT3 #${tokenId}`;
    return loadBestImageForNft(nft, displayName, loadOptions);
  });
}

export { mapWithConcurrency };
