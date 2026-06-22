import { AttachmentBuilder, ApplicationCommandOptionType } from "discord.js";
import {
  DISCORD_GRID_CHANNEL_ID,
  GRID_COOLDOWN_MS,
} from "../config.js";
import { buildGifForWalletInputWithTimeout } from "../gif-service.js";
import { pickGifMessage } from "../util/bot-messages.js";
import { checkCooldown } from "../util/cooldown.js";

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
  if (
    DISCORD_GRID_CHANNEL_ID &&
    interaction.channelId !== DISCORD_GRID_CHANNEL_ID
  ) {
    await interaction.reply({
      content: "Use this command in the designated grid channel.",
      ephemeral: true,
    });
    return;
  }

  const cooldown = checkCooldown(interaction.user.id, GRID_COOLDOWN_MS, "gif");
  if (!cooldown.ok) {
    await interaction.reply({
      content: `Please wait ${cooldown.remainingSeconds}s before requesting another GIF.`,
      ephemeral: true,
    });
    return;
  }

  const wallet = interaction.options.getString("wallet", true);

  await interaction.deferReply();

  try {
    const result = await buildGifForWalletInputWithTimeout(wallet);
    const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });

    await interaction.editReply({
      content: pickGifMessage(),
      files: [attachment],
    });
  } catch (err) {
    console.error("/gif failed", err);
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Something went wrong while building your GIF.";
    await interaction.editReply({ content: message });
  }
}
