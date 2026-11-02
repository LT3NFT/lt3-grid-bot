import { writeFile } from "fs/promises";
import { buildRarityVideoWithTimeout } from "../src/render/rarity-video.js";

const tokenId = process.argv[2] || "4449";
const started = Date.now();

try {
  const result = await buildRarityVideoWithTimeout(tokenId, ({ step }) => {
    console.log(`    ${step}… ${((Date.now() - started) / 1000).toFixed(0)}s`);
  });
  const out = `/tmp/${result.filename}`;
  await writeFile(out, result.buffer);
  console.log(
    `OK /rarity works: LT3 #${tokenId}, ${(result.buffer.length / 1048576).toFixed(2)} MB, ` +
      `${((Date.now() - started) / 1000).toFixed(1)}s → ${out}`
  );
  process.exit(0);
} catch (err) {
  console.error(`FAIL /rarity check: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
