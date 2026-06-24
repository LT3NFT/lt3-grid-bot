import { spawn } from "child_process";
import sharp from "sharp";
import { mapWithConcurrency } from "../nft/load-images.js";
import {
  ffmpegTimeoutForFrameCount,
  gifEncodeScaleTargets,
  gifFpsForCount,
  gifFrameSizeForCount,
  gifRenderConcurrencyForCount,
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

async function encodeGifWithFfmpeg(frameBuffers, fps, outputSize, frameSize, timeoutMs) {
  return new Promise((resolve, reject) => {
    const scale =
      outputSize > 0 && outputSize !== frameSize
        ? `scale=${outputSize}:${outputSize}:flags=lanczos,`
        : "";
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
      `${scale}fps=${fps},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`,
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
      reject(new Error("GIF encoding timed out — try again or use /grid."));
    }, timeoutMs);

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.stdout.on("data", (chunk) => {
      stdoutChunks.push(chunk);
    });
    proc.on("error", (err) => {
      clearTimeout(timeout);
      if (err.code === "ENOENT") {
        reject(new Error("ffmpeg is not installed on the server — contact the team."));
        return;
      }
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

export async function renderCollectionGif(images, hooks = {}) {
  const fps = gifFpsForCount(images.length);
  const renderSize = gifFrameSizeForCount(images.length);
  const renderConcurrency = gifRenderConcurrencyForCount(images.length);
  const encodeTimeoutMs = ffmpegTimeoutForFrameCount(images.length);

  hooks.onStage?.("frames", images.length);
  const frameBuffers = await mapWithConcurrency(images, renderConcurrency, async (image) =>
    renderFramePng(image.buffer, renderSize)
  );

  const encodeTargets = gifEncodeScaleTargets(renderSize);
  for (const outputSize of encodeTargets) {
    hooks.onStage?.("encode", outputSize);
    const buffer = await encodeGifWithFfmpeg(
      frameBuffers,
      fps,
      outputSize,
      renderSize,
      encodeTimeoutMs
    );
    if (buffer.length <= MAX_DISCORD_FILE_BYTES) {
      const finalSize = outputSize > 0 ? outputSize : renderSize;
      return {
        buffer,
        width: finalSize,
        height: finalSize,
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
