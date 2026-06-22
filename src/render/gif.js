import sharp from "sharp";
import { GIFEncoder, quantize, applyPalette } from "gifenc/dist/gifenc.esm.js";
import { GIF_FPS, GIF_FRAME_SIZE, MAX_DISCORD_FILE_BYTES } from "../config.js";

const BACKGROUND = { r: 243, g: 239, b: 228, alpha: 255 };
const FRAME_MS = Math.round(1000 / GIF_FPS);

async function renderFrame(imageBuffer, size) {
  const { data, info } = await sharp(imageBuffer)
    .resize(size, size, {
      fit: "contain",
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

export async function renderCollectionGif(images, frameSize = GIF_FRAME_SIZE) {
  const sizes = [frameSize, 480, 400, 320, 256];

  for (const size of sizes) {
    const frames = [];
    for (const image of images) {
      frames.push(await renderFrame(image.buffer, size));
    }
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
    "GIF is too large for Discord even at reduced size. Try a wallet with fewer LT3s."
  );
}
