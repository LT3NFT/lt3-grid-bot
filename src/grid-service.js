import { gridTimeoutForCount, TRAIT_GRID_EXPORT_LONG_EDGE } from "./config.js";
import {
  fetchAllLt3NftsForOwner,
  loadLt3CollectionFromNfts,
} from "./nft/collection.js";
import { pickRandomNftForTrait, pickRandomNftsForTraitGrid, TRAIT_GRID_SIZE } from "./nft/traits.js";
import { getNftTokenId } from "./nft/normalize.js";
import { generateLayouts } from "./layout/generate.js";
import { getExportDimensionsForLayout } from "./layout/dimensions.js";
import { pickBestLayout } from "./layout/rank.js";
import { renderLayoutToBuffer } from "./render/composite.js";
import { resolveWalletInput, withTimeout } from "./util/wallet-resolve.js";

const TRAIT_GRID_3X3_LAYOUT = {
  id: "grid-3x3-trait",
  name: "3x3",
  aspectRatio: 1,
  fit: "cover",
  rects: Array.from({ length: TRAIT_GRID_SIZE }, (_, index) => ({
    x: (index % 3) / 3,
    y: Math.floor(index / 3) / 3,
    w: 1 / 3,
    h: 1 / 3,
    imageIndex: index,
  })),
};

async function buildGridFromCollection(collection, renderOptions = {}) {
  const { address, display, count, images } = collection;
  const layouts = generateLayouts(images);
  const layout = pickBestLayout(layouts);
  if (!layout) {
    throw new Error("Could not compute a grid layout for this collection.");
  }

  const dims = getExportDimensionsForLayout(layout, images);
  const rendered = await renderLayoutToBuffer(
    layout,
    images,
    dims.width,
    dims.height,
    renderOptions
  );

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

async function buildTraitGridFromCollection(collection) {
  const { address, display, count, images } = collection;
  const edge = TRAIT_GRID_EXPORT_LONG_EDGE;
  const rendered = await renderLayoutToBuffer(
    TRAIT_GRID_3X3_LAYOUT,
    images,
    edge,
    edge,
    { preferJpeg: true, jpegQuality: 88 }
  );

  return {
    address,
    display,
    count,
    layout: TRAIT_GRID_3X3_LAYOUT,
    width: edge,
    height: edge,
    ...rendered,
    filename: `lt3-trait-grid-${edge}x${edge}.${rendered.extension}`,
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

export async function buildGridForTraitMatch(traitType, traitValue) {
  const nfts = await pickRandomNftsForTraitGrid(traitType, traitValue, TRAIT_GRID_SIZE);
  const label = `${traitType}: ${traitValue}`;
  const collection = await loadLt3CollectionFromNfts(nfts, "trait-grid", label, {
    purpose: "trait-grid",
  });
  const result = await buildTraitGridFromCollection(collection);
  return { ...result, traitType, traitValue, count: TRAIT_GRID_SIZE };
}

export async function buildSingleLt3ForTraitMatch(traitType, traitValue) {
  const nft = await pickRandomNftForTrait(traitType, traitValue);
  const tokenId = getNftTokenId(nft);
  if (tokenId == null) {
    throw new Error(`Could not read token id for ${traitType}: ${traitValue}.`);
  }

  const label = `${traitType}: ${traitValue} #${tokenId}`;
  const collection = await loadLt3CollectionFromNfts([nft], "trait-random", label, {
    purpose: "trait-grid",
  });
  const image = collection.images[0];
  if (!image?.buffer) {
    throw new Error(`Could not load image for LT3 #${tokenId}.`);
  }

  return {
    buffer: image.buffer,
    filename: `lt3-${tokenId}.jpg`,
    extension: "jpg",
    mime: "image/jpeg",
    tokenId: String(tokenId),
    traitType,
    traitValue,
  };
}
