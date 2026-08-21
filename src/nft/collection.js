import {
  gridDecodeLongEdgeForCount,
  gifDecodeLongEdgeForCount,
  imageFetchConcurrencyForCount,
  imageFetchConcurrencyForGif,
  MAX_NFT_COUNT,
  TRAIT_GRID_DECODE_LONG_EDGE,
  TRAIT_GRID_IMAGE_CONCURRENCY,
  TRAIT_SINGLE_DECODE_LONG_EDGE,
  TRAIT_SINGLE_JPEG_QUALITY,
} from "../config.js";
import { fetchAllLt3NftsForOwner } from "./fetch.js";
import { loadNftImages } from "./load-images.js";
import { resolveWalletInput } from "../util/wallet-resolve.js";

function validateNftCount(nfts, display) {
  if (!nfts.length) {
    throw new Error(`No LT3 NFTs found for ${display}.`);
  }
  if (nfts.length > MAX_NFT_COUNT) {
    throw new Error(
      `This wallet has ${nfts.length} LT3s — the bot supports up to ${MAX_NFT_COUNT}. Use the web grid tool for larger collections.`
    );
  }
}

export async function loadLt3CollectionFromNfts(nfts, address, display, options = {}) {
  validateNftCount(nfts, display);

  const isGrid = options.purpose === "grid";
  const isGif = options.purpose === "gif";
  const isTraitGrid = options.purpose === "trait-grid";
  const isTraitSingle = options.purpose === "trait-single";
  const images = await loadNftImages(nfts, {
    concurrency: isTraitGrid
      ? TRAIT_GRID_IMAGE_CONCURRENCY
      : isTraitSingle
        ? 1
        : isGif
          ? imageFetchConcurrencyForGif(nfts.length)
          : imageFetchConcurrencyForCount(nfts.length),
    maxLongEdge: isTraitSingle
      ? TRAIT_SINGLE_DECODE_LONG_EDGE
      : isTraitGrid
        ? TRAIT_GRID_DECODE_LONG_EDGE
        : isGrid
          ? gridDecodeLongEdgeForCount(nfts.length)
          : isGif
            ? gifDecodeLongEdgeForCount(nfts.length)
            : 1200,
    maxUrlAttempts: isTraitSingle ? 8 : isTraitGrid ? 3 : isGrid ? 4 : isGif ? 4 : 10,
    preferCdn: isGrid || isGif || isTraitGrid,
    preferHighRes: isTraitSingle,
    skipMetadataRefresh: isGif || isTraitGrid,
    fastImageFetch: isTraitGrid,
    jpegQuality: isTraitSingle ? TRAIT_SINGLE_JPEG_QUALITY : 88,
    highQuality: isTraitSingle,
  });
  return { address, display, count: images.length, images };
}

export async function loadLt3Collection(rawInput, options = {}) {
  const { address, display } = await resolveWalletInput(rawInput);
  const nfts = await fetchAllLt3NftsForOwner(address);
  return loadLt3CollectionFromNfts(nfts, address, display, options);
}

export { fetchAllLt3NftsForOwner };
