import { AttachmentBuilder } from "discord.js";
import { buildGridForTraitMatch, buildSingleLt3ForTraitMatch } from "../grid-service.js";
import { resolveTraitFromText } from "../nft/traits.js";
import { pickTraitGridMessage, pickTraitRandomMessage } from "../util/bot-messages.js";
import { runGridJob } from "../util/heavy-queue.js";

const TRAIT_ACTION_RE =
  /\b(show(?:\s+me)?|display|see|grid|pull up|pull|find(?:\s+me)?|send(?:\s+me)?|give me|grab|get me|any|some|random)\b/i;

const TRAIT_CONTEXT_RE =
  /\b(lt3|trait|headwear|head|outfit|eyes|mouth|base|background|wearing|with the|that have|featuring|fly trap|mask|hoodie|umbrella)\b/i;

const TRAIT_GRID_SIGNAL_RE =
  /\b(grid|gridded|3x3|3×3|nine|sample grid|randomgrid)\b|\blt3s\b|\b(some|any)\s+(lt3|random|ones|pieces|nfts)\b|\b(random\s+)?(ones|pieces|nfts)\b/i;

export function isTraitRequest(text) {
  const t = text.trim();
  if (!t) return false;
  return TRAIT_ACTION_RE.test(t) && TRAIT_CONTEXT_RE.test(t);
}

export function isTraitGridRequest(text) {
  if (!isTraitRequest(text)) return false;
  return TRAIT_GRID_SIGNAL_RE.test(text);
}

export function isTraitSingleRequest(text) {
  if (!isTraitRequest(text)) return false;
  if (isTraitGridRequest(text)) return false;
  return true;
}

function stripTraitRequestBoilerplate(text) {
  return text
    .replace(
      /\b(show(?:\s+me)?|display|see|grid|gridded|randomgrid|pull up|pull|find(?:\s+me)?|send(?:\s+me)?|give me|grab|get me|any|some|random|single)\b/gi,
      " "
    )
    .replace(/\b(lt3s?|nfts?|pieces?|ones?)\b/gi, " ")
    .replace(/\b(with|that have|featuring|wearing|the|a|an|please|thanks|thank you)\b/gi, " ")
    .replace(/\b(trait|head trait|headwear trait|outfit trait|eye trait|base trait)\b/gi, " ")
    .replace(/\b(on (?:their|its) head|headwear|head)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function traitMatchErrorMessage(traitText) {
  const hint = stripTraitRequestBoilerplate(traitText) || traitText.trim();
  return hint
    ? `Could not match "${hint}" to an LT3 trait. Try the exact OpenSea trait name (e.g. Venus Fly Trap) or add a category like headwear.`
    : "Could not figure out which trait you want. Try: show me a Venus Fly Trap LT3";
}

/**
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder, traitType: string, traitValue: string }>}
 */
export async function buildTraitGridFromTraitText(traitText) {
  const match = await resolveTraitFromText(traitText);
  if (!match) {
    throw new Error(traitMatchErrorMessage(traitText));
  }

  const result = await buildGridForTraitMatch(match.traitType, match.value);
  const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });
  const caption = pickTraitGridMessage(match.traitType, match.value);

  return {
    caption,
    attachment,
    traitType: match.traitType,
    traitValue: match.value,
  };
}

/**
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder, traitType: string, traitValue: string, tokenId: string }>}
 */
export async function buildTraitSingleFromTraitText(traitText) {
  const match = await resolveTraitFromText(traitText);
  if (!match) {
    throw new Error(traitMatchErrorMessage(traitText));
  }

  const result = await buildSingleLt3ForTraitMatch(match.traitType, match.value);
  const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });
  const caption = pickTraitRandomMessage(match.traitType, match.value, result.tokenId);

  return {
    caption,
    attachment,
    traitType: match.traitType,
    traitValue: match.value,
    tokenId: result.tokenId,
  };
}

/**
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder, traitType: string, traitValue: string }|null>}
 */
export async function buildTraitGridReply(text) {
  if (!isTraitGridRequest(text)) return null;
  return buildTraitGridFromTraitText(text);
}

/**
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder, traitType: string, traitValue: string, tokenId: string }|null>}
 */
export async function buildTraitSingleReply(text) {
  if (!isTraitSingleRequest(text)) return null;
  return buildTraitSingleFromTraitText(text);
}

/**
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder }|null>}
 */
export async function buildTraitGridReplyQueued(text, hooks = {}) {
  if (!isTraitGridRequest(text)) return null;
  return runGridJob(() => buildTraitGridReply(text), hooks);
}

/**
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder }|null>}
 */
export async function buildTraitSingleReplyQueued(text, hooks = {}) {
  if (!isTraitSingleRequest(text)) return null;
  return runGridJob(() => buildTraitSingleReply(text), hooks);
}
