import { gifTimeoutForCount } from "./config.js";
import {
  fetchAllLt3NftsForOwner,
  loadLt3CollectionFromNfts,
} from "./nft/collection.js";
import { renderCollectionGif } from "./render/gif.js";
import { resolveWalletInput, withTimeout } from "./util/wallet-resolve.js";

async function buildGifFromCollection(collection) {
  const { display, count, images } = collection;
  const rendered = await renderCollectionGif(images);

  return {
    display,
    count,
    ...rendered,
    filename: `lt3-flipbook-${count}@${rendered.fps}fps.gif`,
  };
}

export async function buildGifForWalletInput(rawInput) {
  const { address, display } = await resolveWalletInput(rawInput);
  const nfts = await fetchAllLt3NftsForOwner(address);
  const collection = await loadLt3CollectionFromNfts(nfts, address, display, { purpose: "gif" });
  return buildGifFromCollection(collection);
}

export async function buildGifForWalletInputWithTimeout(rawInput) {
  const { address, display } = await resolveWalletInput(rawInput);
  const nfts = await fetchAllLt3NftsForOwner(address);

  return withTimeout(
    (async () => {
      const collection = await loadLt3CollectionFromNfts(nfts, address, display, { purpose: "gif" });
      return buildGifFromCollection(collection);
    })(),
    gifTimeoutForCount(nfts.length),
    "GIF generation timed out. Try again in a moment, or use /grid for a still image."
  );
}
