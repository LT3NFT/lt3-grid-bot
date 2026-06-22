import { GRID_TIMEOUT_MS } from "./config.js";
import { loadLt3Collection } from "./nft/collection.js";
import { generateLayouts } from "./layout/generate.js";
import { getExportDimensionsForLayout } from "./layout/dimensions.js";
import { pickBestLayout } from "./layout/rank.js";
import { renderLayoutToBuffer } from "./render/composite.js";
import { withTimeout } from "./util/wallet-resolve.js";

export async function buildGridForWalletInput(rawInput) {
  const { address, display, count, images } = await loadLt3Collection(rawInput);
  const layouts = generateLayouts(images);
  const layout = pickBestLayout(layouts);
  if (!layout) {
    throw new Error("Could not compute a grid layout for this collection.");
  }

  const dims = getExportDimensionsForLayout(layout, images);
  const rendered = await renderLayoutToBuffer(layout, images, dims.width, dims.height);

  return {
    address,
    display,
    count,
    layout,
    width: dims.width,
    height: dims.height,
    ...rendered,
    filename: `lt3-grid-${dims.width}x${dims.height}.${rendered.extension}`,
  };
}

export async function buildGridForWalletInputWithTimeout(rawInput) {
  return withTimeout(
    buildGridForWalletInput(rawInput),
    GRID_TIMEOUT_MS,
    "Grid generation timed out. Try again with a smaller collection or later."
  );
}
