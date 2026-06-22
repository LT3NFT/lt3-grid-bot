import sharp from "sharp";
import { renderConcurrencyForCount } from "../config.js";
import { mapWithConcurrency } from "../nft/load-images.js";
import { MAX_DISCORD_FILE_BYTES } from "../layout/dimensions.js";

const BACKGROUND = { r: 243, g: 239, b: 228, alpha: 255 };
const EDGE_OVERLAP = 1;

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
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

export async function renderLayoutToBuffer(layout, images, width, height) {
  const fitMode = layout.fit || "contain";
  const rects = layout.rects.slice().sort((a, b) => a.imageIndex - b.imageIndex);
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const renderConcurrency = renderConcurrencyForCount(images.length);

  const composites = await mapWithConcurrency(rects, renderConcurrency, async (rect) => {
    const image = images[rect.imageIndex];
    if (!image?.buffer) return null;

    const x1 = Math.round(rect.x * w);
    const y1 = Math.round(rect.y * h);
    const x2 = Math.round((rect.x + rect.w) * w);
    const y2 = Math.round((rect.y + rect.h) * h);
    let cellW = Math.max(1, x2 - x1);
    let cellH = Math.max(1, y2 - y1);

    // Slight overlap on interior edges closes sub-pixel gaps without cropping.
    if (x2 < w) cellW += EDGE_OVERLAP;
    if (y2 < h) cellH += EDGE_OVERLAP;

    const fitted = await fitImageToCell(image.buffer, cellW, cellH, fitMode);
    return { input: fitted, left: x1, top: y1 };
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

  let png = await pipeline.png({ compressionLevel: 3 }).toBuffer();
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
