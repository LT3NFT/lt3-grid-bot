import { ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { buildTraitGridFromTraitText } from "../chat/traitGrid.js";
import { DISCORD_GRID_CHANNEL_ID, GRID_COOLDOWN_MS } from "../config.js";
import { checkCooldown } from "../util/cooldown.js";
import { runGridJob } from "../util/heavy-queue.js";
import { safeEditReply, startProgressUpdates } from "../util/safe-interaction.js";

import { publicSlashCommandDefaults } from "./public-defaults.js";

export const randomCommandData = {
  ...publicSlashCommandDefaults,
  name: "random",
  description: "Generate a 3×3 grid of random LT3s matching a trait",
  options: [
    {
      name: "trait",
      description: "Trait name — close enough works (e.g. Venus Fly Trap, ski, fly trap headwear)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

export async function handleRandomCommand(interaction) {
  if (DISCORD_GRID_CHANNEL_ID && interaction.channelId !== DISCORD_GRID_CHANNEL_ID) {
    await safeEditReply(interaction, {
      content: "Use this command in the designated grid channel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cooldown = checkCooldown(interaction.user.id, GRID_COOLDOWN_MS, "random");
  if (!cooldown.ok) {
    await safeEditReply(interaction, {
      content: `Please wait ${cooldown.remainingSeconds}s before requesting another trait grid.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const trait = interaction.options.getString("trait", true);
  const stopProgress = startProgressUpdates(interaction, "Building your trait grid", 8_000);

  try {
    await runGridJob(
      async () => {
        try {
          const result = await buildTraitGridFromTraitText(trait);
          await safeEditReply(interaction, {
            content: result.caption,
            files: [result.attachment],
          });
        } catch (err) {
          console.error("/random failed", err);
          const message =
            err instanceof Error && err.message
              ? err.message
              : "Something went wrong while building your trait grid.";
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
    console.error("/random job failed", err);
    await safeEditReply(interaction, {
      content: "Something went wrong while building your trait grid.",
    });
  } finally {
    stopProgress();
  }
}
