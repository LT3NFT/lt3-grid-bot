import { AttachmentBuilder, ApplicationCommandOptionType } from "discord.js";
import {
  DISCORD_GRID_CHANNEL_ID,
  GRID_COOLDOWN_MS,
} from "../config.js";
import { buildGridForWalletInputWithTimeout } from "../grid-service.js";
import { pickBotMessage } from "../util/bot-messages.js";
import { checkCooldown } from "../util/cooldown.js";

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
    await interaction.reply({
      content: "Use this command in the designated grid channel.",
      ephemeral: true,
    });
    return;
  }

  const cooldown = checkCooldown(interaction.user.id, GRID_COOLDOWN_MS, "grid");
  if (!cooldown.ok) {
    await interaction.reply({
      content: `Please wait ${cooldown.remainingSeconds}s before requesting another grid.`,
      ephemeral: true,
    });
    return;
  }

  const wallet = interaction.options.getString("wallet", true);

  await interaction.deferReply();

  try {
    const result = await buildGridForWalletInputWithTimeout(wallet);
    const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });
    const summary = pickBotMessage();

    await interaction.editReply({
      content: summary,
      files: [attachment],
    });
  } catch (err) {
    console.error("/grid failed", err);
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Something went wrong while building your grid.";
    await interaction.editReply({ content: message });
  }
}
