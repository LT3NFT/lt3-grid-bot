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
    console.log(`Logged in as ${readyClient.user.tag}`);
  });

  client.on("shardDisconnect", (_event, shardId) => {
    console.warn(`Discord shard ${shardId} disconnected — reconnecting`);
  });

  client.on("shardReconnect", (shardId) => {
    console.log(`Discord shard ${shardId} reconnected`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "grid" && interaction.commandName !== "gif") return;

    // Defer in the first microtask — never gate on a stale "ready" flag after reconnect.
    void (async () => {
      if (!(await deferOrExplain(interaction))) return;

      console.log(`/${interaction.commandName} from ${interaction.user.tag}`);

      const run =
        interaction.commandName === "grid"
          ? handleGridCommand(interaction)
          : handleGifCommand(interaction);

      run.catch((err) => {
        console.error("Command handler error", err);
      });
    })();
  });

  client.on("error", (err) => {
    console.error("Discord client error", err);
  });
}
