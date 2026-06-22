import { spawn } from "child_process";
import sharp from "sharp";
import { mapWithConcurrency } from "../nft/load-images.js";
import {
  gifFpsForCount,
  gifFrameSizeForCount,
  MAX_DISCORD_FILE_BYTES,
} from "../config.js";

const BACKGROUND = { r: 243, g: 239, b: 228, alpha: 255 };
const FFMPEG_ENCODE_TIMEOUT_MS = 180_000;

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

async function encodeGifWithFfmpeg(frameBuffers, fps) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "-framerate",
      String(fps),
      "-i",
      "pipe:0",
      "-vf",
      `fps=${fps},scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`,
      "-loop",
      "0",
      "-f",
      "gif",
      "pipe:1",
    ];

    const proc = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    const stdoutChunks = [];
    const timeout = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("GIF encoding timed out."));
    }, FFMPEG_ENCODE_TIMEOUT_MS);

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.stdout.on("data", (chunk) => {
      stdoutChunks.push(chunk);
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    proc.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks));
        return;
      }
      reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-400)}`));
    });

    (async () => {
      try {
        for (const frame of frameBuffers) {
          if (!proc.stdin.write(frame)) {
            await new Promise((res) => proc.stdin.once("drain", res));
          }
        }
        proc.stdin.end();
      } catch (err) {
        clearTimeout(timeout);
        proc.kill("SIGKILL");
        reject(err);
      }
    })();
  });
}

export async function renderCollectionGif(images) {
  const fps = gifFpsForCount(images.length);
  const startSize = gifFrameSizeForCount(images.length);
  const sizes = [512, 480, 440, 400, 360, 320, 280, 240, 200].filter(
    (size) => size <= startSize
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
