import sharp from "sharp";
import { LT3_ALCHEMY_KEY, LT3_CONTRACT_LC } from "../config.js";
import {
  expandImageUrlCandidates,
  getHighResNftImageUrlCandidates,
  getNftContractAddressLc,
  getNftImageUrlCandidates,
  getNftTokenId,
  isLikelyLowResImageUrl,
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
      if (host === "alchemy.mypinata.cloud") return 1;
      if (host.includes("cloudinary.com") && url.includes("convert-png")) return 2;
      if (host.includes("cloudinary.com")) return 3;
      if (host.includes("pinata")) return 5;
      if (host === "dweb.link") return 6;
      if (host === "ipfs.io") return 7;
      return 4;
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
  const sourceUrls = options.preferHighRes
    ? [
        ...getHighResNftImageUrlCandidates(nft),
        ...(options.allowLowResUrls ? getNftImageUrlCandidates(nft) : []),
      ]
    : getNftImageUrlCandidates(nft);

  const seen = new Set();
  const deduped = [];
  for (const url of sourceUrls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    deduped.push(url);
  }

  let ranked = rankImageUrls(
    expandImageUrlCandidates(deduped, {
      upgradeHighRes: options.preferHighRes,
      targetEdge: options.maxLongEdge ?? 2048,
    })
  );

  if (options.preferHighRes && !options.allowLowResUrls) {
    const strict = ranked.filter((url) => !isLikelyLowResImageUrl(url));
    if (strict.length) ranked = strict;
  }

  if (options.preferCdn) {
    const cdn = ranked.filter(isCdnUrl);
    if (cdn.length) return cdn;
  }
  return ranked;
}

function timeoutForUrl(url, preferCdn, fastImageFetch) {
  if (fastImageFetch) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes("alchemy.com") || host.includes("cloudinary.com")) return 5_000;
      if (host.includes("ipfs") || host === "dweb.link" || host.includes("pinata")) return 8_000;
    } catch {
      // ignore
    }
    return 6_000;
  }

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

async function loadImageFromUrl(
  url,
  displayName,
  timeoutMs,
  maxLongEdge = 1200,
  jpegQuality = 88,
  highQuality = false,
  minSourceEdge = 0
) {
  const buffer = await fetchImageBuffer(url, timeoutMs);
  const inputMeta = await sharp(buffer).metadata();
  const sourceEdge = Math.max(inputMeta.width ?? 0, inputMeta.height ?? 0);
  if (highQuality && minSourceEdge > 0 && sourceEdge > 0 && sourceEdge < minSourceEdge) {
    throw new Error(`Source too small (${sourceEdge}px)`);
  }

  let pipeline = sharp(buffer).resize(maxLongEdge, maxLongEdge, {
    fit: "inside",
    withoutEnlargement: true,
    ...(highQuality ? { kernel: sharp.kernel.lanczos3 } : {}),
  });
  pipeline = pipeline.jpeg({
    quality: jpegQuality,
    ...(highQuality ? { mozjpeg: true } : {}),
  });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    name: displayName,
    width: info.width || 1,
    height: info.height || 1,
    buffer: data,
  };
}

async function tryLoadFromUrl(
  url,
  displayName,
  maxLongEdge,
  preferCdn,
  fastImageFetch,
  jpegQuality = 88,
  highQuality = false,
  minSourceEdge = 0
) {
  const timeoutMs = timeoutForUrl(url, preferCdn, fastImageFetch);
  const retries = fastImageFetch ? 1 : 2;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await loadImageFromUrl(
        url,
        displayName,
        timeoutMs,
        maxLongEdge,
        jpegQuality,
        highQuality,
        minSourceEdge
      );
    } catch (err) {
      if (attempt === retries - 1) throw err;
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

async function tryUrlsForNft(nft, displayName, options) {
  const urls = urlsForAttempt(nft, options);
  const maxAttempts = options.maxUrlAttempts ?? 10;
  for (const url of urls.slice(0, maxAttempts)) {
    try {
      return await tryLoadFromUrl(
        url,
        displayName,
        options.maxLongEdge ?? 1200,
        options.preferCdn,
        options.fastImageFetch,
        options.jpegQuality ?? 88,
        options.highQuality ?? false,
        options.minSourceEdge ?? 0
      );
    } catch {
      // try next candidate
    }
  }
  return null;
}

/**
 * Prefer CDN when asked, but if every CDN candidate fails, fall through to IPFS / other hosts
 * so one broken Alchemy thumbnail does not wipe the token out of a grid/GIF.
 */
async function loadImageWithFallbacks(nft, displayName, options) {
  if (options.preferHighRes) {
    const highRes = await tryUrlsForNft(nft, displayName, {
      ...options,
      allowLowResUrls: false,
    });
    if (highRes) return highRes;

    const lowRes = await tryUrlsForNft(nft, displayName, {
      ...options,
      allowLowResUrls: true,
      minSourceEdge: 0,
    });
    if (lowRes) return lowRes;
  } else {
    const preferred = await tryUrlsForNft(nft, displayName, options);
    if (preferred) return preferred;
  }

  if (options.preferCdn) {
    const withoutCdn = await tryUrlsForNft(nft, displayName, {
      ...options,
      preferCdn: false,
      preferHighRes: false,
      allowLowResUrls: true,
      minSourceEdge: 0,
      maxUrlAttempts: Math.max(options.maxUrlAttempts ?? 4, 10),
    });
    if (withoutCdn) return withoutCdn;
  }

  return null;
}

async function loadBestImageForNft(nft, displayName, options) {
  let sourceNft = nft;
  if (options.preferAlchemyFirst) {
    const refreshed = await fetchNftMetadata(nft);
    if (refreshed) {
      sourceNft = {
        ...nft,
        ...refreshed,
        tokenId: getNftTokenId(nft) ?? refreshed.tokenId,
      };
    }
  }

  const first = await loadImageWithFallbacks(sourceNft, displayName, options);
  if (first) return first;

  if (!options.preferAlchemyFirst) {
    const refreshed = await fetchNftMetadata(nft);
    if (refreshed) {
      const image = await loadImageWithFallbacks(
        { ...nft, ...refreshed, tokenId: getNftTokenId(nft) ?? refreshed.tokenId },
        displayName,
        {
          ...options,
          preferCdn: false,
          preferHighRes: Boolean(options.preferHighRes),
          allowLowResUrls: true,
          minSourceEdge: 0,
          maxUrlAttempts: 10,
        }
      );
      if (image) return image;
    }
  }

  console.warn(`Skipping ${displayName} — could not load an image`);
  return null;
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
    preferHighRes: options.preferHighRes ?? false,
    fastImageFetch: options.fastImageFetch ?? false,
    jpegQuality: options.jpegQuality ?? 88,
    highQuality: options.highQuality ?? false,
    minSourceEdge: options.minSourceEdge ?? 0,
    preferAlchemyFirst: options.preferAlchemyFirst ?? false,
    allowLowResUrls: options.allowLowResUrls ?? false,
  };

  const loaded = await mapWithConcurrency(nfts, concurrency, async (nft) => {
    const tokenId = getNftTokenId(nft) ?? "?";
    const displayName = `LT3 #${tokenId}`;
    return loadBestImageForNft(nft, displayName, loadOptions);
  });

  const images = loaded.filter(Boolean);
  const skipped = nfts.length - images.length;
  if (skipped > 0) {
    console.warn(`[images] skipped ${skipped} of ${nfts.length} LT3s (no usable image)`);
  }
  return images;
}

export { mapWithConcurrency };
