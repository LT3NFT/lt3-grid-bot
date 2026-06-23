import { AttachmentBuilder, ApplicationCommandOptionType, MessageFlags } from "discord.js";
import {
  DISCORD_GRID_CHANNEL_ID,
  GRID_COOLDOWN_MS,
} from "../config.js";
import { buildGifForWalletInputWithTimeout } from "../gif-service.js";
import { pickGifMessage } from "../util/bot-messages.js";
import { checkCooldown } from "../util/cooldown.js";
import { runHeavyJob } from "../util/heavy-queue.js";
import { safeDeferReply, safeEditReply, startProgressUpdates } from "../util/safe-interaction.js";

export const gifCommandData = {
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
  if (!(await safeDeferReply(interaction))) return;

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

  runHeavyJob(
    async () => {
      const stopProgress = startProgressUpdates(interaction, "Building your GIF");
      try {
        const result = await buildGifForWalletInputWithTimeout(wallet);
        const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });

        await safeEditReply(interaction, {
          content: pickGifMessage(),
          files: [attachment],
        });
      } catch (err) {
        console.error("/gif failed", err);
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Something went wrong while building your GIF.";
        await safeEditReply(interaction, { content: message });
      } finally {
        stopProgress();
      }
    },
    {
      onQueued: (ahead) => {
        safeEditReply(interaction, {
          content: `Hang tight — ${ahead} other request${ahead === 1 ? "" : "s"} ahead of yours.`,
        });
      },
    }
  ).catch((err) => {
    console.error("/gif job failed", err);
  });
}
