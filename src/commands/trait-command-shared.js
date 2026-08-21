import { MessageFlags } from "discord.js";
import { DISCORD_GRID_CHANNEL_ID, GRID_COOLDOWN_MS } from "../config.js";
import { checkCooldown } from "../util/cooldown.js";
import { runGridJob } from "../util/heavy-queue.js";
import { safeEditReply, startProgressUpdates } from "../util/safe-interaction.js";

/**
 * @param {import("discord.js").ChatInputCommandInteraction} interaction
 * @param {{
 *   build: () => Promise<{ caption: string, attachment: import("discord.js").AttachmentBuilder }>,
 *   cooldownKey: string,
 *   progressLabel: string,
 *   errorLabel: string,
 *   progressIntervalMs?: number,
 * }} options
 */
export async function handleTraitSlashCommand(interaction, options) {
  if (DISCORD_GRID_CHANNEL_ID && interaction.channelId !== DISCORD_GRID_CHANNEL_ID) {
    await safeEditReply(interaction, {
      content: "Use this command in the designated grid channel.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const cooldown = checkCooldown(interaction.user.id, GRID_COOLDOWN_MS, options.cooldownKey);
  if (!cooldown.ok) {
    await safeEditReply(interaction, {
      content: `Please wait ${cooldown.remainingSeconds}s before trying again.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const stopProgress = startProgressUpdates(
    interaction,
    options.progressLabel,
    options.progressIntervalMs ?? 8_000
  );

  try {
    await runGridJob(
      async () => {
        try {
          const result = await options.build();
          await safeEditReply(interaction, {
            content: result.caption,
            files: [result.attachment],
          });
        } catch (err) {
          console.error(`${options.errorLabel} failed`, err);
          const message =
            err instanceof Error && err.message
              ? err.message
              : `Something went wrong — ${options.errorLabel}.`;
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
    console.error(`${options.errorLabel} job failed`, err);
    await safeEditReply(interaction, {
      content: `Something went wrong — ${options.errorLabel}.`,
    });
  } finally {
    stopProgress();
  }
}
