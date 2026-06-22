import { assertBotConfig } from "../src/config.js";

try {
  assertBotConfig();
  console.log("Configuration OK — ready to register commands and start the bot.");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
