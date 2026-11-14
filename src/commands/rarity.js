import { AttachmentBuilder, ApplicationCommandOptionType, MessageFlags } from "discord.js";
import { DISCORD_GRID_CHANNEL_ID, GRID_COOLDOWN_MS } from "../config.js";
import {
  buildRarityVideoWithTimeout,
  friendlyRarityError,
  parseRarityTokenId,
} from "../render/rarity-video.js";
import { pickRarityMessage } from "../util/bot-messages.js";
import { checkCooldown } from "../util/cooldown.js";
import { runRarityExclusive } from "../util/rarity-lock.js";
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
  // Keep the deferred reply alive so a slow cold Chrome start doesn't look frozen.
  progress.heartbeat(`Beep boop. Still working on LT3 #${tokenId}…`);

  try {
    // Own lock — never sit behind a multi-minute /gif in the heavy queue.
    await runRarityExclusive(
      async () => {
        try {
          const t0 = Date.now();
          const result = await buildRarityVideoWithTimeout(tokenId, (stage) => {
            const step = typeof stage === "object" ? stage?.step : stage;
            const base = STAGE_TEXT[step] || "Working";
            progress.show(`Beep boop. LT3 #${tokenId}: ${base}…`);
          });
          progress.stop();
          const secs = ((Date.now() - t0) / 1000).toFixed(1);
          console.log(`[rarity] /rarity #${tokenId} delivered in ${secs}s`);
          const attachment = new AttachmentBuilder(result.buffer, { name: result.filename });
          await safeEditReply(interaction, {
            content: pickRarityMessage(result),
            files: [attachment],
          });
        } catch (err) {
          progress.stop();
          console.error("/rarity failed", err);
          await safeEditReply(interaction, { content: friendlyRarityError(err) });
        }
      },
      {
        onQueued: (ahead) => {
          progress.show(
            `Hang tight — ${ahead} other rarity request${ahead === 1 ? "" : "s"} ahead of yours.`
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
      content: friendlyRarityError(err),
    });
  } finally {
    progress.stop();
  }
}
