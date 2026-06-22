import sharp from "sharp";
import { MAX_DISCORD_FILE_BYTES } from "../layout/dimensions.js";

const BACKGROUND = { r: 243, g: 239, b: 228, alpha: 255 };

async function fitImageToCell(imageBuffer, cellW, cellH, fitMode) {
  const mode = fitMode === "cover" ? "cover" : "contain";
  const background = mode === "contain" ? BACKGROUND : { r: 0, g: 0, b: 0, alpha: 0 };
  return sharp(imageBuffer)
    .resize(Math.max(1, Math.round(cellW)), Math.max(1, Math.round(cellH)), {
      fit: mode,
      position: "centre",
      background,
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();
}

export async function renderLayoutToBuffer(layout, images, width, height) {
  const canvas = sharp({
    create: {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      channels: 4,
      background: BACKGROUND,
    },
  });

  const fitMode = layout.fit || "contain";
  const rects = layout.rects.slice().sort((a, b) => a.imageIndex - b.imageIndex);
  const composites = [];

  for (const rect of rects) {
    const image = images[rect.imageIndex];
    if (!image?.buffer) continue;

    const x1 = Math.round(rect.x * width);
    const y1 = Math.round(rect.y * height);
    const x2 = Math.round((rect.x + rect.w) * width);
    const y2 = Math.round((rect.y + rect.h) * height);
    const cellW = Math.max(1, x2 - x1);
    const cellH = Math.max(1, y2 - y1);

    const fitted = await fitImageToCell(image.buffer, cellW, cellH, fitMode);
    composites.push({ input: fitted, left: x1, top: y1 });
  }

  let pipeline = canvas.composite(composites);

  let png = await pipeline.png({ compressionLevel: 6 }).toBuffer();
  if (png.length <= MAX_DISCORD_FILE_BYTES) {
    return { buffer: png, extension: "png", mime: "image/png" };
  }

  let quality = 92;
  while (quality >= 60) {
    const jpg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpg.length <= MAX_DISCORD_FILE_BYTES) {
      return { buffer: jpg, extension: "jpg", mime: "image/jpeg" };
    }
    quality -= 8;
  }

  const scaled = await sharp(png)
    .resize(Math.max(1, Math.floor(width * 0.75)), Math.max(1, Math.floor(height * 0.75)))
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  return { buffer: scaled, extension: "jpg", mime: "image/jpeg" };
}
