import { gifTimeoutForCount } from "./config.js";
import { loadLt3Collection } from "./nft/collection.js";
import { renderCollectionGif } from "./render/gif.js";
import { withTimeout } from "./util/wallet-resolve.js";

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
  return buildGifFromCollection(await loadLt3Collection(rawInput));
}

export async function buildGifForWalletInputWithTimeout(rawInput) {
  const collection = await loadLt3Collection(rawInput);
  const timeoutMs = gifTimeoutForCount(collection.count);
  return withTimeout(
    buildGifFromCollection(collection),
    timeoutMs,
    "GIF generation timed out. Try again with a smaller collection or later."
  );
}
