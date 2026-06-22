import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import sharp from "sharp";
import { mapWithConcurrency } from "../nft/load-images.js";
import {
  gifFpsForCount,
  gifFrameSizeForCount,
  MAX_DISCORD_FILE_BYTES,
} from "../config.js";

const BACKGROUND = { r: 243, g: 239, b: 228, alpha: 255 };

async function renderFramePng(imageBuffer, size) {
  return sharp(imageBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      background: BACKGROUND,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 6 })
    .toBuffer();
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-400)}`));
    });
  });
}

async function encodeGifWithFfmpeg(frameBuffers, fps) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lt3gif-"));
  const outPath = path.join(dir, "out.gif");

  try {
    await mapWithConcurrency(
      frameBuffers,
      16,
      async (buffer, index) => {
        const name = `frame_${String(index).padStart(4, "0")}.png`;
        await fs.writeFile(path.join(dir, name), buffer);
      }
    );

    await runFfmpeg([
      "-y",
      "-framerate",
      String(fps),
      "-i",
      path.join(dir, "frame_%04d.png"),
      "-vf",
      `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`,
      "-loop",
      "0",
      outPath,
    ]);

    return fs.readFile(outPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function renderCollectionGif(images) {
  const fps = gifFpsForCount(images.length);
  const startSize = gifFrameSizeForCount(images.length);
  const sizes = [startSize, 200, 180, 160].filter(
    (size, index, arr) => arr.indexOf(size) === index && size <= startSize
  );

  const renderConcurrency = images.length > 60 ? 16 : 12;

  for (const size of sizes) {
    const frameBuffers = await mapWithConcurrency(images, renderConcurrency, async (image) =>
      renderFramePng(image.buffer, size)
    );

    const buffer = await encodeGifWithFfmpeg(frameBuffers, fps);
    if (buffer.length <= MAX_DISCORD_FILE_BYTES) {
      return {
        buffer,
        width: size,
        height: size,
        frameCount: images.length,
        fps,
        extension: "gif",
        mime: "image/gif",
      };
    }
  }

  throw new Error(
    `GIF is too large for Discord (${images.length} LT3s). Try /grid instead, or a wallet with fewer LT3s.`
  );
}
