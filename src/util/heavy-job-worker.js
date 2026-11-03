/**
 * Child process for grid/gif/rarity so the Discord gateway process stays free to ACK slash commands.
 * Parent sends { type, payload }; we reply with progress / result / error.
 */
import "dotenv/config";
import { writeFile } from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import { randomBytes } from "crypto";

sharp.concurrency(Number(process.env.SHARP_CONCURRENCY) || 2);
sharp.cache({ memory: 32, files: 0 });

function send(msg) {
  if (typeof process.send === "function") process.send(msg);
}

async function writeResult(result) {
  const outPath = path.join(os.tmpdir(), `lt3-job-${randomBytes(8).toString("hex")}`);
  await writeFile(outPath, result.buffer);
  const { buffer: _omit, ...meta } = result;
  return { ...meta, outPath, bytes: result.buffer.length };
}

async function run(type, payload) {
  const onProgress = (stage) => send({ type: "progress", stage });

  if (type === "gif") {
    const { buildGifForWalletInputWithTimeout } = await import("../gif-service.js");
    return writeResult(await buildGifForWalletInputWithTimeout(payload.wallet, onProgress));
  }
  if (type === "grid") {
    const { buildGridForWalletInputWithTimeout } = await import("../grid-service.js");
    return writeResult(await buildGridForWalletInputWithTimeout(payload.wallet, onProgress));
  }
  if (type === "rarity") {
    const { buildRarityVideoWithTimeout } = await import("../render/rarity-video.js");
    return writeResult(await buildRarityVideoWithTimeout(payload.tokenId, onProgress));
  }
  throw new Error(`Unknown heavy job type: ${type}`);
}

process.on("message", (msg) => {
  void (async () => {
    try {
      const result = await run(msg.type, msg.payload || {});
      send({ type: "result", result });
    } catch (err) {
      send({ type: "error", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setTimeout(() => process.exit(0), 50);
    }
  })();
});
