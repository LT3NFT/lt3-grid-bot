import { AttachmentBuilder } from "discord.js";
import { buildGridForTraitMatch } from "../grid-service.js";
import { resolveTraitFromText } from "../nft/traits.js";
import { pickTraitGridMessage } from "../util/bot-messages.js";
import { runGridJob } from "../util/heavy-queue.js";

const TRAIT_GRID_REQUEST_RE =
  /\b(show(?:\s+me)?|display|see|grid|pull up|find(?:\s+me)?|send(?:\s+me)?|give me|grab|get me|any|some|random)\b/i;

const TRAIT_CONTEXT_RE =
  /\b(lt3|trait|headwear|head|outfit|eyes|mouth|base|background|wearing|with the|that have|featuring|fly trap|mask|hoodie|umbrella)\b/i;

export function isTraitGridRequest(text) {
  const t = text.trim();
  if (!t) return false;
  return TRAIT_GRID_REQUEST_RE.test(t) && TRAIT_CONTEXT_RE.test(t);
}

function stripTraitGridBoilerplate(text) {
  return text
    .replace(/\b(show(?:\s+me)?|display|see|grid|pull up|find(?:\s+me)?|send(?:\s+me)?|give me|grab|get me|any|some|random)\b/gi, " ")
    .replace(/\b(lt3s?|nfts?|pieces?|ones?)\b/gi, " ")
    .replace(/\b(with|that have|featuring|wearing|the|a|an|please|thanks|thank you)\b/gi, " ")
    .replace(/\b(trait|head trait|headwear trait|outfit trait|eye trait|base trait)\b/gi, " ")
    .replace(/\b(on (?:their|its) head|headwear|head)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder, traitType: string, traitValue: string }|null>}
 */
export async function buildTraitGridReply(text) {
  if (!isTraitGridRequest(text)) return null;

  const match = await resolveTraitFromText(text);
  if (!match) {
    const hint = stripTraitGridBoilerplate(text);
    throw new Error(
      hint
        ? `Could not match "${hint}" to an LT3 trait. Try the exact OpenSea trait name (e.g. Venus Fly Trap).`
        : "Could not figure out which trait you want. Try: show me LT3s with Venus Fly Trap headwear."
    );
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
 * @returns {Promise<{ caption: string, attachment: AttachmentBuilder }|null>}
 */
export async function buildTraitGridReplyQueued(text, hooks = {}) {
  if (!isTraitGridRequest(text)) return null;
  return runGridJob(() => buildTraitGridReply(text), hooks);
}
