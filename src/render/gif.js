import { spawn } from "child_process";
import sharp from "sharp";
import { mapWithConcurrency } from "../nft/load-images.js";
import {
  gifFpsForCount,
  gifFrameSizeForCount,
  MAX_DISCORD_FILE_BYTES,
} from "../config.js";

const BACKGROUND = { r: 243, g: 239, b: 228, alpha: 255 };
const FFMPEG_ENCODE_TIMEOUT_MS = 120_000;

async function renderFrameJpeg(imageBuffer, size) {
  return sharp(imageBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      background: BACKGROUND,
      kernel: sharp.kernel.lanczos3,
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

async function encodeGifWithFfmpeg(frameBuffers, fps, outputSize) {
  return new Promise((resolve, reject) => {
    const scale =
      outputSize > 0
        ? `scale=${outputSize}:${outputSize}:flags=lanczos,`
        : "";
    const args = [
      "-y",
      "-f",
      "image2pipe",
      "-vcodec",
      "mjpeg",
      "-framerate",
      String(fps),
      "-i",
      "pipe:0",
      "-vf",
      `${scale}fps=${fps},split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=single[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`,
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
  const renderSize = gifFrameSizeForCount(images.length);
  const renderConcurrency = Math.min(20, Math.max(12, images.length));

  const frameBuffers = await mapWithConcurrency(images, renderConcurrency, async (image) =>
    renderFrameJpeg(image.buffer, renderSize)
  );

  const sizes = [512, 480, 440, 400, 360, 320, 280, 240, 200].filter(
    (size) => size <= renderSize
  );

  for (const size of sizes) {
    const buffer = await encodeGifWithFfmpeg(frameBuffers, fps, size);
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
