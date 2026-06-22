import sharp from "sharp";
import { expandImageUrlCandidates, getNftImageUrlCandidates, getNftTokenId } from "./normalize.js";

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

function timeoutForUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("ipfs") || host === "dweb.link" || host.includes("pinata")) {
      return 20_000;
    }
  } catch {
    // ignore
  }
  return 12_000;
}

async function loadImageFromUrl(url, displayName, timeoutMs, maxLongEdge = 1200) {
  const buffer = await fetchImageBuffer(url, timeoutMs);
  const resized = await sharp(buffer)
    .resize(maxLongEdge, maxLongEdge, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;
  return {
    name: displayName,
    width,
    height,
    buffer: resized,
  };
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

async function loadBestImageForNft(nft, displayName) {
  const urls = expandImageUrlCandidates(getNftImageUrlCandidates(nft));
  if (!urls.length) {
    throw new Error(`No image URL for ${displayName}`);
  }

  for (const url of urls.slice(0, 8)) {
    try {
      return await loadImageFromUrl(url, displayName, timeoutForUrl(url));
    } catch {
      // try next candidate
    }
  }

  throw new Error(`Could not load image for ${displayName}`);
}

export async function loadNftImages(nfts, options = {}) {
  const concurrency = options.concurrency ?? 8;

  return mapWithConcurrency(nfts, concurrency, async (nft) => {
    const tokenId = getNftTokenId(nft) ?? "?";
    const displayName = `LT3 #${tokenId}`;
    return loadBestImageForNft(nft, displayName);
  });
}

export { mapWithConcurrency };
