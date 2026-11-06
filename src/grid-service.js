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

export async function buildGridForWalletInputWithTimeout(rawInput, onProgress) {
  onProgress?.("wallet");
  const { address, display } = await resolveWalletInput(rawInput);
  onProgress?.("fetch");
  const nfts = await fetchAllLt3NftsForOwner(address);

  return withTimeout(
    (async () => {
      onProgress?.("images");
      const collection = await loadLt3CollectionFromNfts(nfts, address, display, { purpose: "grid" });
      onProgress?.("compose");
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

/** Canonical LT3 art folder on IPFS (same CID OpenSea uses for original_image_url). */
const LT3_IMAGE_IPFS_CID = "QmRYnu6yVbRPEk3yfkoQ11o1KAVjhxuP5FTs8gR58CE8nG";

function nftStubFromTokenId(tokenId) {
  const id = String(tokenId);
  return {
    tokenId: id,
    identifier: id,
    original_image_url: `ipfs://${LT3_IMAGE_IPFS_CID}/${id}.png`,
    image_url: `https://alchemy.mypinata.cloud/ipfs/${LT3_IMAGE_IPFS_CID}/${id}.png`,
    display_image_url: `https://lt3tools.com/tools/assets/lt3/${id}.jpg`,
    contract: { address: "0x4ef6f6a7ee7d1cf7f1f7bfad2ba56baab868de48" },
  };
}

function squareGridLayout(count) {
  const edge = Math.round(Math.sqrt(count));
  if (edge * edge !== count) return null;
  return {
    id: `grid-${edge}x${edge}-fixed`,
    name: `${edge}x${edge}`,
    aspectRatio: 1,
    fit: "cover",
    rects: Array.from({ length: count }, (_, index) => ({
      x: (index % edge) / edge,
      y: Math.floor(index / edge) / edge,
      w: 1 / edge,
      h: 1 / edge,
      imageIndex: index,
    })),
  };
}

/**
 * Build a grid from explicit LT3 token ids (e.g. top rarest).
 * @param {Array<string|number>} tokenIds
 * @param {{ label?: string, exportLongEdge?: number }} [options]
 */
export async function buildGridForTokenIds(tokenIds, options = {}) {
  const ids = [...new Set(tokenIds.map((id) => String(id)).filter((id) => /^\d+$/.test(id)))];
  if (!ids.length) throw new Error("No LT3 token ids to grid.");

  const nfts = ids.map(nftStubFromTokenId);
  const label = options.label || `token-grid-${ids.length}`;
  const collection = await loadLt3CollectionFromNfts(nfts, "token-grid", label, {
    purpose: "grid",
  });

  const fixed = squareGridLayout(collection.images.length);
  if (fixed) {
    const edge = options.exportLongEdge || Math.min(2400, Math.max(1200, collection.images.length * 120));
    const rendered = await renderLayoutToBuffer(fixed, collection.images, edge, edge, {
      preferJpeg: true,
      jpegQuality: 88,
    });
    return {
      address: collection.address,
      display: collection.display,
      count: collection.images.length,
      layout: fixed,
      width: edge,
      height: edge,
      tokenIds: ids,
      ...rendered,
      filename: `lt3-rarity-grid-${edge}x${edge}.${rendered.extension}`,
    };
  }

  const result = await buildGridFromCollection(collection);
  return {
    ...result,
    tokenIds: ids,
    filename: `lt3-rarity-grid-${result.width}x${result.height}.${result.extension}`,
  };
}

export async function buildSingleLt3ForTraitMatch(traitType, traitValue) {
  const nft = await pickRandomNftForTrait(traitType, traitValue);
  const tokenId = getNftTokenId(nft);
  if (tokenId == null) {
    throw new Error(`Could not read token id for ${traitType}: ${traitValue}.`);
  }

  const label = `${traitType}: ${traitValue} #${tokenId}`;
  const collection = await loadLt3CollectionFromNfts([nft], "trait-random", label, {
    purpose: "trait-single",
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
