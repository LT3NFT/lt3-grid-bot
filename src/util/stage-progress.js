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
  let heartbeatTimer = null;
  let heartbeatBase = "";
  let heartbeatN = 0;

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

  const stopHeartbeat = () => {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  return {
    show,
    /**
     * Re-edit every few seconds with a living status so long jobs don't look hung.
     * @param {string} text
     * @param {number} [everyMs]
     */
    heartbeat: (text, everyMs = 8_000) => {
      if (stopped) return;
      heartbeatBase = text;
      stopHeartbeat();
      heartbeatTimer = setInterval(() => {
        if (stopped) return;
        heartbeatN += 1;
        const dots = ".".repeat((heartbeatN % 3) + 1);
        show(`${heartbeatBase}${dots}`);
      }, everyMs);
      if (typeof heartbeatTimer.unref === "function") heartbeatTimer.unref();
    },
    stop: () => {
      stopped = true;
      clearTimeout(pendingTimer);
      stopHeartbeat();
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
