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
import { randomCommandData, handleRandomCommand } from "./commands/random.js";
import { randomgridCommandData, handleRandomgridCommand } from "./commands/randomgrid.js";
import { wireChat } from "./chat/handler.js";

export function createBotClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
}

export async function registerGuildCommands() {
  assertBotConfig();
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

  // Drop global commands — only guild commands, with no default role lock.
  await rest.put(Routes.applicationCommands(DISCORD_APPLICATION_ID), { body: [] });

  return rest.put(Routes.applicationGuildCommands(DISCORD_APPLICATION_ID, DISCORD_GUILD_ID), {
    body: [gridCommandData, gifCommandData, randomCommandData, randomgridCommandData],
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
        content: "Bot is reconnecting — wait 10 seconds and try a fresh `/grid`, `/gif`, `/random`, or `/randomgrid`.",
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
    void registerGuildCommands()
      .then((registered) => {
        const names = registered.map((cmd) => `/${cmd.name}`).join(", ");
        console.log(`Slash commands synced: ${names}`);
      })
      .catch((err) => {
        console.error("Failed to sync slash commands on startup", err);
      });
  });

  client.on("shardDisconnect", (_event, shardId) => {
    console.warn(`Discord shard ${shardId} disconnected — reconnecting`);
  });

  client.on("shardReconnect", (shardId) => {
    console.log(`Discord shard ${shardId} reconnected`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (
      interaction.commandName !== "grid" &&
      interaction.commandName !== "gif" &&
      interaction.commandName !== "random" &&
      interaction.commandName !== "randomgrid"
    ) {
      return;
    }

    // Defer in the first microtask — never gate on a stale "ready" flag after reconnect.
    void (async () => {
      if (!(await deferOrExplain(interaction))) return;

      console.log(`/${interaction.commandName} from ${interaction.user.tag}`);

      let run;
      switch (interaction.commandName) {
        case "grid":
          run = handleGridCommand(interaction);
          break;
        case "gif":
          run = handleGifCommand(interaction);
          break;
        case "random":
          run = handleRandomCommand(interaction);
          break;
        default:
          run = handleRandomgridCommand(interaction);
          break;
      }

      run.catch((err) => {
        console.error("Command handler error", err);
      });
    })();
  });

  client.on("error", (err) => {
    console.error("Discord client error", err);
  });

  wireChat(client);
}
