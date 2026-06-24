import { AttachmentBuilder, ApplicationCommandOptionType, MessageFlags } from "discord.js";
import {
  DISCORD_GRID_CHANNEL_ID,
  GRID_COOLDOWN_MS,
} from "../config.js";
import { buildGifForWalletInputWithTimeout } from "../gif-service.js";
import { pickGifMessage } from "../util/bot-messages.js";
import { checkCooldown } from "../util/cooldown.js";
import { runGifJob } from "../util/heavy-queue.js";
import { safeEditReply, startProgressUpdates } from "../util/safe-interaction.js";
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

function stageMessage(stage, detail) {
  switch (stage) {
    case "resolve":
      return "Looking up wallet…";
    case "fetch":
      return typeof detail === "number"
        ? `Found ${detail} LT3${detail === 1 ? "" : "s"} — loading artwork…`
        : "Fetching your LT3s…";
    case "images":
      return `Loading artwork for ${detail} LT3${detail === 1 ? "" : "s"}…`;
    case "frames":
      return `Rendering ${detail} flipbook frame${detail === 1 ? "" : "s"}…`;
    case "encode":
      return `Encoding GIF (${detail}px) — almost there…`;
    default:
      return "Building your GIF…";
  }
}

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
  let lastStageAt = 0;
  const reportStage = (stage, detail) => {
    const now = Date.now();
    if (now - lastStageAt < 4000) return;
    lastStageAt = now;
    void safeEditReply(interaction, { content: stageMessage(stage, detail) });
  };

  const stopProgress = startProgressUpdates(interaction, "Building your GIF", 15_000);

  try {
    await runGifJob(
      async () => {
        try {
          const result = await buildGifForWalletInputWithTimeout(wallet, {
            onStage: reportStage,
          });
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
    console.error("/gif job failed", err);
    await safeEditReply(interaction, {
      content: "Something went wrong while building your GIF.",
    });
  } finally {
    stopProgress();
  }
}
