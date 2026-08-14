import "dotenv/config";
import { fetchLt3StatsReply } from "../src/chat/collectionStats.js";
import { OPENSEA_API_KEY } from "../src/config.js";

if (!OPENSEA_API_KEY) {
  console.error("FAIL: OPENSEA_API_KEY missing from .env");
  process.exit(1);
}

const reply = await fetchLt3StatsReply("how many are listed");
console.log("Listed reply:", reply);

if (!/\d/.test(reply)) {
  console.error("FAIL: reply has no number");
  process.exit(1);
}

console.log("\nStats test passed.");
