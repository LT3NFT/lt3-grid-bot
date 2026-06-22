import sharp from "sharp";
import { GIFEncoder, quantize, applyPalette } from "gifenc/dist/gifenc.esm.js";
import { mapWithConcurrency } from "../nft/load-images.js";
import {
  GIF_FPS,
  MAX_DISCORD_FILE_BYTES,
  gifFrameSizeForCount,
} from "../config.js";

const BACKGROUND = { r: 243, g: 239, b: 228, alpha: 255 };
const FRAME_MS = Math.round(1000 / GIF_FPS);

async function renderFrame(imageBuffer, size) {
  const { data, info } = await sharp(imageBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
      background: BACKGROUND,
      kernel: sharp.kernel.lanczos3,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height };
}

function encodeGif(frames, delayMs) {
  const encoder = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.data, 256);
    const index = applyPalette(frame.data, palette);
    encoder.writeFrame(index, frame.width, frame.height, { palette, delay: delayMs });
  }
  encoder.finish();
  return Buffer.from(encoder.bytes());
}

export async function renderCollectionGif(images) {
  const startSize = gifFrameSizeForCount(images.length);
  const sizes = [startSize, 320, 256, 224].filter(
    (size, index, arr) => arr.indexOf(size) === index && size <= startSize
  );

  for (const size of sizes) {
    const frames = await mapWithConcurrency(
      images,
      images.length > 60 ? 10 : 8,
      async (image) => renderFrame(image.buffer, size)
    );
    const buffer = encodeGif(frames, FRAME_MS);
    if (buffer.length <= MAX_DISCORD_FILE_BYTES) {
      return {
        buffer,
        width: size,
        height: size,
        frameCount: images.length,
        fps: GIF_FPS,
        extension: "gif",
        mime: "image/gif",
      };
    }
  }

  throw new Error(
    `GIF is too large for Discord (${images.length} LT3s). Try /grid instead, or a wallet with fewer LT3s.`
  );
}
