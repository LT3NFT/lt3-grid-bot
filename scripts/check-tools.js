/**
 * Runs LT3BOT tools through the same builders the slash commands use, without Discord.
 *   npm run check-tools              # snappy suite (~30–60s on VM)
 *   npm run check-tools -- --full    # also big 100-LT3 wallet
 *   npm run check-tools -- --only=gif,rarity
 */
import "dotenv/config";
import { MAX_DISCORD_FILE_BYTES } from "../src/config.js";
import { buildGridForWalletInputWithTimeout } from "../src/grid-service.js";
import { buildGifForWalletInputWithTimeout } from "../src/gif-service.js";
import { buildTraitGridFromTraitText, buildTraitSingleFromTraitText } from "../src/chat/traitGrid.js";
import { buildRarityVideoWithTimeout } from "../src/render/rarity-video.js";

const ENS_WALLET = "animalvault.eth";
const BIG_WALLET = "0x62541dfaf846c8c0171a1755b2c057673d88dac7";

const checks = [
  { name: "grid", label: `/grid ${ENS_WALLET}`, run: () => buildGridForWalletInputWithTimeout(ENS_WALLET) },
  {
    name: "grid-big",
    fullOnly: true,
    label: "/grid 100-LT3 wallet",
    run: () => buildGridForWalletInputWithTimeout(BIG_WALLET),
  },
  { name: "gif", label: `/gif ${ENS_WALLET}`, run: () => buildGifForWalletInputWithTimeout(ENS_WALLET) },
  {
    name: "gif-big",
    fullOnly: true,
    label: "/gif 100-LT3 wallet",
    run: () => buildGifForWalletInputWithTimeout(BIG_WALLET),
  },
  {
    name: "random",
    label: "/random trait:ski",
    run: async () => {
      const r = await buildTraitSingleFromTraitText("ski");
      return { buffer: r.attachment.attachment, count: 1, note: `LT3 #${r.tokenId}` };
    },
  },
  {
    name: "randomgrid",
    label: "/randomgrid trait:venus fly trap",
    run: async () => {
      const r = await buildTraitGridFromTraitText("venus fly trap");
      return { buffer: r.attachment.attachment, count: 9, note: `${r.traitType}: ${r.traitValue}` };
    },
  },
  {
    name: "rarity",
    label: "/rarity token:4449",
    run: async () => {
      const r = await buildRarityVideoWithTimeout("4449");
      return { ...r, count: 1, note: `rank ${r.rank}` };
    },
  },
];

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",").filter(Boolean)) : null;
const full = process.argv.includes("--full");

function shouldRun(check) {
  if (only) return only.has(check.name);
  if (check.fullOnly && !full) return false;
  return true;
}

let failed = 0;
for (const check of checks) {
  if (!shouldRun(check)) continue;

  const started = Date.now();
  try {
    const result = await check.run();
    const bytes = result.buffer?.length ?? 0;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const sizeMb = (bytes / 1048576).toFixed(2);
    if (!bytes) throw new Error("empty output");
    if (bytes > MAX_DISCORD_FILE_BYTES) throw new Error(`${sizeMb} MB is over Discord's limit`);
    const extra = [result.count != null ? `${result.count} LT3s` : "", result.note || ""]
      .filter(Boolean)
      .join(", ");
    console.log(`PASS  ${check.label} — ${seconds}s, ${sizeMb} MB${extra ? `, ${extra}` : ""}`);
  } catch (err) {
    failed += 1;
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`FAIL  ${check.label} — ${seconds}s: ${err instanceof Error ? err.message : err}`);
  }
}

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll tools working.");
process.exit(failed ? 1 : 0);
