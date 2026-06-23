import { AttachmentBuilder, ApplicationCommandOptionType, MessageFlags } from "discord.js";
import {
  DISCORD_GRID_CHANNEL_ID,
  GRID_COOLDOWN_MS,
} from "../config.js";
import { buildGridForWalletInputWithTimeout } from "../grid-service.js";
import { pickBotMessage } from "../util/bot-messages.js";
import { checkCooldown } from "../util/cooldown.js";
import { runGridJob } from "../util/heavy-queue.js";
import { safeEditReply, startProgressUpdates } from "../util/safe-interaction.js";

export const gridCommandData = {
  name: "grid",
  description: "Generate a near-square LT3 grid from a wallet address or ENS name",
  options: [
    {
      name: "wallet",
      description: "Ethereum address (0x...) or ENS name (e.g. name.eth)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

export async function handleGridCommand(interaction) {
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

  const cooldown = checkCooldown(interaction.user.id, GRID_COOLDOWN_MS, "grid");
  if (!cooldown.ok) {
    await safeEditReply(interaction, {
      content: `Please wait ${cooldown.remainingSeconds}s before requesting another grid.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const wallet = interaction.options.getString("wallet", true);

  runGridJob(
    async () => {
      const stopProgress = startProgressUpdates(interaction, "Building your grid");
      try {
        const result = await buildGridForWalletInputWithTimeout(wallet);
        const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });
        const summary = pickBotMessage();

        await safeEditReply(interaction, {
          content: summary,
          files: [attachment],
        });
      } catch (err) {
        console.error("/grid failed", err);
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Something went wrong while building your grid.";
        await safeEditReply(interaction, { content: message });
      } finally {
        stopProgress();
      }
    },
    {
      onQueued: (ahead) => {
        void safeEditReply(interaction, {
          content: `Hang tight — ${ahead} other grid${ahead === 1 ? "" : "s"} ahead of yours.`,
        });
      },
    }
  ).catch((err) => {
    console.error("/grid job failed", err);
    void safeEditReply(interaction, {
      content: "Something went wrong while building your grid.",
    });
  });
}
