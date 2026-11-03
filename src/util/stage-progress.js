import { safeEditReply } from "./safe-interaction.js";

const MIN_EDIT_GAP_MS = 2_500;

/**
 * Throttled deferred-reply updates so users always see movement without Discord rate limits.
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 */
export function createStageProgress(interaction) {
  let stopped = false;
  let lastText = "";
  let lastAt = 0;
  let pending = null;
  let pendingTimer = null;

  const flush = () => {
    pendingTimer = null;
    if (stopped || !pending || pending === lastText) return;
    lastText = pending;
    lastAt = Date.now();
    void safeEditReply(interaction, { content: pending });
  };

  const show = (text) => {
    if (stopped) return;
    pending = text;
    const wait = MIN_EDIT_GAP_MS - (Date.now() - lastAt);
    if (wait <= 0) flush();
    else if (!pendingTimer) pendingTimer = setTimeout(flush, wait);
  };

  return {
    show,
    stop: () => {
      stopped = true;
      clearTimeout(pendingTimer);
    },
  };
}

export const GIF_STAGE_TEXT = {
  wallet: "Reading the wallet",
  fetch: "Finding your LT3s",
  images: "Loading the art",
  frames: "Building the flipbook",
  encode: "Saving the GIF",
};

export const GRID_STAGE_TEXT = {
  wallet: "Reading the wallet",
  fetch: "Finding your LT3s",
  images: "Loading the art",
  compose: "Composing the grid",
};
