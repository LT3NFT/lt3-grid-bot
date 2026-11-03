import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { assertBotConfig, DISCORD_TOKEN } from "../src/config.js";
import { postToolsReminder } from "../src/util/toolsReminderSchedule.js";

async function main() {
  assertBotConfig();
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(DISCORD_TOKEN);

  try {
    const { channel, sent } = await postToolsReminder(client);
    console.log(`Posted tools reminder to #${channel.name} (${channel.id}) — message ${sent.id}`);
  } finally {
    await client.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
