import {
  Client,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
} from "discord.js";
import {
  assertBotConfig,
  DISCORD_APPLICATION_ID,
  DISCORD_GUILD_ID,
  DISCORD_TOKEN,
} from "./config.js";
import { gridCommandData, handleGridCommand } from "./commands/grid.js";
import { gifCommandData, handleGifCommand } from "./commands/gif.js";

let botReady = false;

export function isBotReady() {
  return botReady;
}

export function createBotClient() {
  return new Client({ intents: [GatewayIntentBits.Guilds] });
}

export async function registerGuildCommands() {
  assertBotConfig();
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(DISCORD_APPLICATION_ID, DISCORD_GUILD_ID), {
    body: [gridCommandData, gifCommandData],
  });
}

async function deferOrExplain(interaction) {
  try {
    await interaction.deferReply();
    return true;
  } catch (err) {
    console.error("deferReply failed", err);
    try {
      await interaction.reply({
        content: "Bot is reconnecting — wait 10 seconds and try a fresh `/grid` or `/gif`.",
        ephemeral: true,
      });
    } catch {
      // ignore
    }
    return false;
  }
}

export function wireBot(client) {
  client.once(Events.ClientReady, (readyClient) => {
    botReady = true;
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "grid" && interaction.commandName !== "gif") return;

    const run = async () => {
      if (!botReady) {
        try {
          await interaction.reply({
            content: "Bot is still starting up — try again in a few seconds.",
            ephemeral: true,
          });
        } catch {
          // ignore
        }
        return;
      }

      if (!(await deferOrExplain(interaction))) return;

      console.log(`/${interaction.commandName} from ${interaction.user.tag}`);

      if (interaction.commandName === "grid") {
        await handleGridCommand(interaction);
      } else if (interaction.commandName === "gif") {
        await handleGifCommand(interaction);
      }
    };

    run().catch((err) => {
      console.error("Interaction handler error", err);
    });
  });

  client.on("error", (err) => {
    console.error("Discord client error", err);
  });
}
