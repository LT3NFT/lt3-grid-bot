import { gifTimeoutForCount } from "./config.js";
import {
  fetchAllLt3NftsForOwner,
  loadLt3CollectionFromNfts,
} from "./nft/collection.js";
import { renderCollectionGif } from "./render/gif.js";
import { resolveWalletInput, withTimeout } from "./util/wallet-resolve.js";

async function buildGifFromCollection(collection, hooks = {}) {
  const { display, count, images } = collection;
  const rendered = await renderCollectionGif(images, hooks);

  return {
    display,
    count,
    ...rendered,
    filename: `lt3-flipbook-${count}@${rendered.fps}fps.gif`,
  };
}

export async function buildGifForWalletInput(rawInput, hooks = {}) {
  const { address, display } = await resolveWalletInput(rawInput);
  hooks.onStage?.("resolve");
  const nfts = await fetchAllLt3NftsForOwner(address);
  hooks.onStage?.("fetch", nfts.length);
  const collection = await loadLt3CollectionFromNfts(nfts, address, display, { purpose: "gif" });
  hooks.onStage?.("images", collection.count);
  return buildGifFromCollection(collection, hooks);
}

export async function buildGifForWalletInputWithTimeout(rawInput, hooks = {}) {
  const { address, display } = await resolveWalletInput(rawInput);
  hooks.onStage?.("resolve");
  const nfts = await fetchAllLt3NftsForOwner(address);
  hooks.onStage?.("fetch", nfts.length);

  return withTimeout(
    (async () => {
      const collection = await loadLt3CollectionFromNfts(nfts, address, display, { purpose: "gif" });
      hooks.onStage?.("images", collection.count);
      return buildGifFromCollection(collection, hooks);
    })(),
    gifTimeoutForCount(nfts.length),
    "GIF generation timed out. Try again in a moment, or use /grid for a still image."
  );
}
