import {
  gridDecodeLongEdgeForCount,
  gifDecodeLongEdgeForCount,
  imageFetchConcurrencyForCount,
  MAX_NFT_COUNT,
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
  const images = await loadNftImages(nfts, {
    concurrency: imageFetchConcurrencyForCount(nfts.length),
    maxLongEdge: isGrid
      ? gridDecodeLongEdgeForCount(nfts.length)
      : isGif
        ? gifDecodeLongEdgeForCount(nfts.length)
        : 1200,
    maxUrlAttempts: isGrid ? 4 : isGif ? 4 : 10,
    preferCdn: isGrid || isGif,
    skipMetadataRefresh: isGif,
  });
  return { address, display, count: images.length, images };
}

export async function loadLt3Collection(rawInput, options = {}) {
  const { address, display } = await resolveWalletInput(rawInput);
  const nfts = await fetchAllLt3NftsForOwner(address);
  return loadLt3CollectionFromNfts(nfts, address, display, options);
}

export { fetchAllLt3NftsForOwner };
