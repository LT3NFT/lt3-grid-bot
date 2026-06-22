import { GIF_TIMEOUT_MS } from "./config.js";
import { loadLt3Collection } from "./nft/collection.js";
import { renderCollectionGif } from "./render/gif.js";
import { withTimeout } from "./util/wallet-resolve.js";

export async function buildGifForWalletInput(rawInput) {
  const { display, count, images } = await loadLt3Collection(rawInput);
  const rendered = await renderCollectionGif(images);

  return {
    display,
    count,
    ...rendered,
    filename: `lt3-flipbook-${count}@${rendered.fps}fps.gif`,
  };
}

export async function buildGifForWalletInputWithTimeout(rawInput) {
  return withTimeout(
    buildGifForWalletInput(rawInput),
    GIF_TIMEOUT_MS,
    "GIF generation timed out. Try again with a smaller collection or later."
  );
}
