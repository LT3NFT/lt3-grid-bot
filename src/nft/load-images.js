import sharp from "sharp";
import { getNftImageUrlCandidates, getNftTokenId } from "./normalize.js";

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

async function loadImageFromUrl(url, displayName, timeoutMs) {
  const buffer = await fetchImageBuffer(url, timeoutMs);
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 1;
  const height = meta.height || 1;
  return {
    name: displayName,
    width,
    height,
    buffer,
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

const MIN_IMAGE_LONG_EDGE = 800;

async function loadBestImageForNft(nft, displayName, { fast = false } = {}) {
  const candidates = getNftImageUrlCandidates(nft);
  if (!candidates.length) {
    throw new Error(`No image URL for ${displayName}`);
  }

  const timeoutMs = fast ? 12_000 : 20_000;
  const urls = fast ? candidates.slice(0, 2) : candidates;

  if (fast) {
    for (const url of urls) {
      try {
        return await loadImageFromUrl(url, displayName, timeoutMs);
      } catch {
        // try next
      }
    }
    throw new Error(`Could not load image for ${displayName}`);
  }

  let best = null;
  for (const url of urls) {
    try {
      const loaded = await loadImageFromUrl(url, displayName, timeoutMs);
      const longEdge = Math.max(loaded.width, loaded.height);
      if (!best || longEdge > Math.max(best.width, best.height)) {
        best = loaded;
      }
      if (longEdge >= MIN_IMAGE_LONG_EDGE) break;
    } catch {
      // try next candidate
    }
  }

  if (!best) {
    throw new Error(`Could not load image for ${displayName}`);
  }
  return best;
}

export async function loadNftImages(nfts, options = {}) {
  const concurrency = options.concurrency ?? 8;
  const fast = options.fast ?? false;

  return mapWithConcurrency(nfts, concurrency, async (nft) => {
    const tokenId = getNftTokenId(nft) ?? "?";
    const displayName = `LT3 #${tokenId}`;
    return loadBestImageForNft(nft, displayName, { fast });
  });
}

export { mapWithConcurrency };
