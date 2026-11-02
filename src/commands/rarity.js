import { AttachmentBuilder, ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { DISCORD_GRID_CHANNEL_ID, GRID_COOLDOWN_MS } from "../config.js";
import { buildRarityVideoWithTimeout, parseRarityTokenId } from "../render/rarity-video.js";
import { pickRarityMessage } from "../util/bot-messages.js";
import { checkCooldown } from "../util/cooldown.js";
import { runGifJob } from "../util/heavy-queue.js";
import { safeEditReply } from "../util/safe-interaction.js";
import { publicSlashCommandDefaults } from "./public-defaults.js";

export const rarityCommandData = {
  ...publicSlashCommandDefaults,
  name: "rarity",
  description: "Rarity Breakdown video for one LT3 — every layer and how rare it is",
  options: [
    {
      name: "token",
      description: "LT3 token number (e.g. 4449 or #4449)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

export async function handleRarityCommand(interaction) {
  if (DISCORD_GRID_CHANNEL_ID && interaction.channelId !== DISCORD_GRID_CHANNEL_ID) {
    await safeEditReply(interaction, {
      content: "Use this command in the designated grid channel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const tokenId = parseRarityTokenId(interaction.options.getString("token", true));
  if (!tokenId) {
    await safeEditReply(interaction, {
      content: "Enter an LT3 token number from 1 to 5,555.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cooldown = checkCooldown(interaction.user.id, GRID_COOLDOWN_MS, "rarity");
  if (!cooldown.ok) {
    await safeEditReply(interaction, {
      content: `Please wait ${cooldown.remainingSeconds}s before requesting another breakdown.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const progress = createStageProgress(interaction, tokenId);
  progress.show(`Beep boop. Breaking down LT3 #${tokenId}…`);

  try {
    await runGifJob(
      async () => {
        try {
          const result = await buildRarityVideoWithTimeout(tokenId, progress.onStage);
          progress.stop();
          const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });
          await safeEditReply(interaction, {
            content: pickRarityMessage(result),
            files: [attachment],
          });
        } catch (err) {
          progress.stop();
          console.error("/rarity failed", err);
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Something went wrong while building the breakdown.";
          await safeEditReply(interaction, { content: message });
        }
      },
      {
        onQueued: (ahead) => {
          void safeEditReply(interaction, {
            content: `Hang tight — ${ahead} other request${ahead === 1 ? "" : "s"} ahead of yours.`,
          });
        },
      }
    );
  } catch (err) {
    console.error("/rarity job failed", err);
    await safeEditReply(interaction, {
      content: "Something went wrong while building the breakdown.",
    });
  } finally {
    progress.stop();
  }
}

const STAGE_TEXT = {
  open: "Opening the Rarity Breakdown",
  load: "Separating the layers",
  frames: "Rendering",
  encode: "Encoding the video",
};
const MIN_EDIT_GAP_MS = 4_000;

/** Edits the deferred reply with the current stage, at most once every few seconds. */
function createStageProgress(interaction, tokenId) {
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
    onStage: ({ step, percent }) => {
      const base = STAGE_TEXT[step] || "Working";
      const suffix = step === "frames" && Number.isFinite(percent) ? ` ${percent}%` : "";
      show(`Beep boop. LT3 #${tokenId}: ${base}${suffix}…`);
    },
    stop: () => {
      stopped = true;
      clearTimeout(pendingTimer);
    },
  };
}
