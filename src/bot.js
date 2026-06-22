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

export function wireBot(client) {
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      if (interaction.commandName === "grid") {
        await handleGridCommand(interaction);
      } else if (interaction.commandName === "gif") {
        await handleGifCommand(interaction);
      }
    } catch (err) {
      console.error("Interaction handler error", err);
    }
  });

  client.on("error", (err) => {
    console.error("Discord client error", err);
  });
}
