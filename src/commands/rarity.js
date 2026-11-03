import { AttachmentBuilder, ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { DISCORD_GRID_CHANNEL_ID, GRID_COOLDOWN_MS, RARITY_TIMEOUT_MS } from "../config.js";
import { parseRarityTokenId } from "../render/rarity-video.js";
import { pickRarityMessage } from "../util/bot-messages.js";
import { checkCooldown } from "../util/cooldown.js";
import { runGifJob } from "../util/heavy-queue.js";
import { runHeavyJob } from "../util/run-heavy-job.js";
import { safeEditReply } from "../util/safe-interaction.js";
import { createStageProgress } from "../util/stage-progress.js";
import { publicSlashCommandDefaults } from "./public-defaults.js";

export const rarityCommandData = {
  ...publicSlashCommandDefaults,
  name: "rarity",
  description: "Rarity Breakdown image for one LT3 — every layer and how rare it is",
  options: [
    {
      name: "token",
      description: "LT3 token number (e.g. 4449 or #4449)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

const STAGE_TEXT = {
  open: "Opening the Rarity Breakdown",
  load: "Separating the layers",
  still: "Saving the breakdown",
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

  const progress = createStageProgress(interaction);
  progress.show(`Beep boop. Breaking down LT3 #${tokenId}…`);

  try {
    await runGifJob(
      async () => {
        try {
          const result = await runHeavyJob(
            "rarity",
            { tokenId },
            {
              timeoutMs: RARITY_TIMEOUT_MS + 30_000,
              onProgress: (stage) => {
                const step = typeof stage === "object" ? stage?.step : stage;
                const base = STAGE_TEXT[step] || "Working";
                progress.show(`Beep boop. LT3 #${tokenId}: ${base}…`);
              },
            }
          );
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
          progress.show(
            `Hang tight — ${ahead} other request${ahead === 1 ? "" : "s"} ahead of yours.`
          );
        },
        onStart: () => {
          progress.show(`Beep boop. Breaking down LT3 #${tokenId}…`);
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
