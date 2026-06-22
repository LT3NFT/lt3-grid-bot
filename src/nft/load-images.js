import sharp from "sharp";
import { getNftImageUrlCandidates, getNftTokenId } from "./normalize.js";

async function fetchImageBuffer(url) {
  const res = await fetch(url, {
    headers: { Accept: "image/*,*/*" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Image fetch failed (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function loadImageFromUrl(url, displayName) {
  const buffer = await fetchImageBuffer(url);
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

async function loadBestImageForNft(nft, displayName) {
  const candidates = getNftImageUrlCandidates(nft);
  if (!candidates.length) {
    throw new Error(`No image URL for ${displayName}`);
  }

  let best = null;
  for (const url of candidates) {
    try {
      const loaded = await loadImageFromUrl(url, displayName);
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

export async function loadNftImages(nfts, concurrency = 8) {
  return mapWithConcurrency(nfts, concurrency, async (nft) => {
    const tokenId = getNftTokenId(nft) ?? "?";
    const displayName = `LT3 #${tokenId}`;
    return loadBestImageForNft(nft, displayName);
  });
}
