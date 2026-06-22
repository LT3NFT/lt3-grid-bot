import {
  imageFetchConcurrencyForCount,
  MAX_NFT_COUNT,
} from "../config.js";
import { fetchAllLt3NftsForOwner } from "./fetch.js";
import { loadNftImages } from "./load-images.js";
import { resolveWalletInput } from "../util/wallet-resolve.js";

export async function loadLt3Collection(rawInput) {
  const { address, display } = await resolveWalletInput(rawInput);

  const nfts = await fetchAllLt3NftsForOwner(address);
  if (!nfts.length) {
    throw new Error(`No LT3 NFTs found for ${display}.`);
  }
  if (nfts.length > MAX_NFT_COUNT) {
    throw new Error(
      `This wallet has ${nfts.length} LT3s — the bot supports up to ${MAX_NFT_COUNT}. Use the web grid tool for larger collections.`
    );
  }

  const images = await loadNftImages(nfts, {
    concurrency: imageFetchConcurrencyForCount(nfts.length),
    fast: nfts.length > 40,
  });
  return { address, display, count: images.length, images };
}
