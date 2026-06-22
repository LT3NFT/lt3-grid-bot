import { gridTimeoutForCount } from "./config.js";
import {
  fetchAllLt3NftsForOwner,
  loadLt3CollectionFromNfts,
} from "./nft/collection.js";
import { generateLayouts } from "./layout/generate.js";
import { getExportDimensionsForLayout } from "./layout/dimensions.js";
import { pickBestLayout } from "./layout/rank.js";
import { renderLayoutToBuffer } from "./render/composite.js";
import { resolveWalletInput, withTimeout } from "./util/wallet-resolve.js";

async function buildGridFromCollection(collection) {
  const { address, display, count, images } = collection;
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

export async function buildGridForWalletInput(rawInput) {
  const { address, display } = await resolveWalletInput(rawInput);
  const nfts = await fetchAllLt3NftsForOwner(address);
  const collection = await loadLt3CollectionFromNfts(nfts, address, display, { purpose: "grid" });
  return buildGridFromCollection(collection);
}

export async function buildGridForWalletInputWithTimeout(rawInput) {
  const { address, display } = await resolveWalletInput(rawInput);
  const nfts = await fetchAllLt3NftsForOwner(address);

  return withTimeout(
    (async () => {
      const collection = await loadLt3CollectionFromNfts(nfts, address, display, { purpose: "grid" });
      return buildGridFromCollection(collection);
    })(),
    gridTimeoutForCount(nfts.length),
    "Grid generation timed out. Large collections can take several minutes — try again in a moment."
  );
}
