import sharp from "sharp";
import { mapWithConcurrency } from "../nft/load-images.js";
import { MAX_DISCORD_FILE_BYTES } from "../layout/dimensions.js";

const BACKGROUND = { r: 243, g: 239, b: 228, alpha: 255 };
const CELL_BLEED = 2;

function toPixelRects(rects, width, height) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const pixelRects = rects.map((rect) => ({
    imageIndex: rect.imageIndex,
    x1: Math.floor(rect.x * w),
    y1: Math.floor(rect.y * h),
    x2: Math.ceil((rect.x + rect.w) * w),
    y2: Math.ceil((rect.y + rect.h) * h),
  }));

  // Close sub-pixel gaps between adjacent cells.
  for (const pr of pixelRects) {
    pr.x2 = Math.min(w, pr.x2 + 1);
    pr.y2 = Math.min(h, pr.y2 + 1);
  }

  return { pixelRects, width: w, height: h };
}

async function fitImageToCell(imageBuffer, cellW, cellH) {
  return sharp(imageBuffer)
    .resize(
      Math.max(1, Math.round(cellW + CELL_BLEED * 2)),
      Math.max(1, Math.round(cellH + CELL_BLEED * 2)),
      {
        fit: "cover",
        position: "centre",
        kernel: sharp.kernel.lanczos3,
      }
    )
    .png()
    .toBuffer();
}

export async function renderLayoutToBuffer(layout, images, width, height) {
  const rects = layout.rects.slice().sort((a, b) => a.imageIndex - b.imageIndex);
  const { pixelRects, width: w, height: h } = toPixelRects(rects, width, height);
  const renderConcurrency = images.length > 60 ? 10 : images.length > 30 ? 8 : 6;

  const composites = await mapWithConcurrency(pixelRects, renderConcurrency, async (rect) => {
    const image = images[rect.imageIndex];
    if (!image?.buffer) return null;

    const cellW = Math.max(1, rect.x2 - rect.x1);
    const cellH = Math.max(1, rect.y2 - rect.y1);
    const fitted = await fitImageToCell(image.buffer, cellW, cellH);

    return {
      input: fitted,
      left: Math.max(0, rect.x1 - CELL_BLEED),
      top: Math.max(0, rect.y1 - CELL_BLEED),
    };
  });

  const canvas = sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: BACKGROUND,
    },
  });

  let pipeline = canvas.composite(composites.filter(Boolean));

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
    .resize(Math.max(1, Math.floor(w * 0.75)), Math.max(1, Math.floor(h * 0.75)))
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  return { buffer: scaled, extension: "jpg", mime: "image/jpeg" };
}
