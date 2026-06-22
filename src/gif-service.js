import { gifTimeoutForCount, MAX_NFT_COUNT } from "./config.js";
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
  const collection = await loadLt3Collection(rawInput);
  return buildGifFromCollection(collection);
}

export async function buildGifForWalletInputWithTimeout(rawInput) {
  return withTimeout(
    (async () => {
      const collection = await loadLt3Collection(rawInput);
      return buildGifFromCollection(collection);
    })(),
    gifTimeoutForCount(MAX_NFT_COUNT),
    "GIF generation timed out. Large collections can take several minutes — try again or use /grid."
  );
}
