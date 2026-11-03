import { AttachmentBuilder, ApplicationCommandOptionType, MessageFlags } from "discord.js";
import {
  DISCORD_GRID_CHANNEL_ID,
  GRID_COOLDOWN_MS,
  gifTimeoutForCount,
  MAX_NFT_COUNT,
} from "../config.js";
import { pickGifMessage } from "../util/bot-messages.js";
import { checkCooldown } from "../util/cooldown.js";
import { runGifJob } from "../util/heavy-queue.js";
import { runHeavyJob } from "../util/run-heavy-job.js";
import { safeEditReply } from "../util/safe-interaction.js";
import { createStageProgress, GIF_STAGE_TEXT } from "../util/stage-progress.js";
import { publicSlashCommandDefaults } from "./public-defaults.js";

export const gifCommandData = {
  ...publicSlashCommandDefaults,
  name: "gif",
  description: "Generate a flipbook GIF of your LT3s (5 FPS, saveable for X)",
  options: [
    {
      name: "wallet",
      description: "Ethereum address (0x...) or ENS name (e.g. name.eth)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

export async function handleGifCommand(interaction) {
  if (
    DISCORD_GRID_CHANNEL_ID &&
    interaction.channelId !== DISCORD_GRID_CHANNEL_ID
  ) {
    await safeEditReply(interaction, {
      content: "Use this command in the designated grid channel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cooldown = checkCooldown(interaction.user.id, GRID_COOLDOWN_MS, "gif");
  if (!cooldown.ok) {
    await safeEditReply(interaction, {
      content: `Please wait ${cooldown.remainingSeconds}s before requesting another GIF.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const wallet = interaction.options.getString("wallet", true);
  const progress = createStageProgress(interaction);
  progress.show("Beep boop. Building your GIF…");

  try {
    await runGifJob(
      async () => {
        try {
          const result = await runHeavyJob(
            "gif",
            { wallet },
            {
              timeoutMs: gifTimeoutForCount(MAX_NFT_COUNT),
              onProgress: (stage) => {
                const key = typeof stage === "string" ? stage : stage?.step;
                const label = GIF_STAGE_TEXT[key] || "Working";
                progress.show(`Beep boop. ${label}…`);
              },
            }
          );
          progress.stop();
          const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });
          await safeEditReply(interaction, {
            content: pickGifMessage(),
            files: [attachment],
          });
        } catch (err) {
          progress.stop();
          console.error("/gif failed", err);
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Something went wrong while building your GIF.";
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
          progress.show("Beep boop. Building your GIF…");
        },
      }
    );
  } catch (err) {
    console.error("/gif job failed", err);
    await safeEditReply(interaction, {
      content: "Something went wrong while building your GIF.",
    });
  } finally {
    progress.stop();
  }
}
