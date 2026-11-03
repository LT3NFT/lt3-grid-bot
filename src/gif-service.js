import { gifTimeoutForCount } from "./config.js";
import {
  fetchAllLt3NftsForOwner,
  loadLt3CollectionFromNfts,
} from "./nft/collection.js";
import { renderCollectionGif } from "./render/gif.js";
import { resolveWalletInput, withTimeout } from "./util/wallet-resolve.js";

async function buildGifFromCollection(collection, onProgress) {
  const { display, count, images } = collection;
  const rendered = await renderCollectionGif(images, onProgress);

  return {
    display,
    count,
    ...rendered,
    filename: `lt3-flipbook-${count}@${rendered.fps}fps.gif`,
  };
}

export async function buildGifForWalletInput(rawInput, onProgress) {
  onProgress?.("wallet");
  const { address, display } = await resolveWalletInput(rawInput);
  onProgress?.("fetch");
  const nfts = await fetchAllLt3NftsForOwner(address);
  onProgress?.("images");
  const collection = await loadLt3CollectionFromNfts(nfts, address, display, { purpose: "gif" });
  return buildGifFromCollection(collection, onProgress);
}

export async function buildGifForWalletInputWithTimeout(rawInput, onProgress) {
  onProgress?.("wallet");
  const { address, display } = await resolveWalletInput(rawInput);
  onProgress?.("fetch");
  const nfts = await fetchAllLt3NftsForOwner(address);

  return withTimeout(
    (async () => {
      onProgress?.("images");
      const collection = await loadLt3CollectionFromNfts(nfts, address, display, { purpose: "gif" });
      return buildGifFromCollection(collection, onProgress);
    })(),
    gifTimeoutForCount(nfts.length),
    "GIF generation timed out. Try again in a moment, or use /grid for a still image."
  );
}
