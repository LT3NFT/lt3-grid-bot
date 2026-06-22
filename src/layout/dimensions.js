import {
  MAX_DISCORD_FILE_BYTES,
  MAX_DISCORD_LONG_EDGE,
  MIN_DISCORD_LONG_EDGE,
  MAX_EXPORT_CANVAS_EDGE,
  MAX_EXPORT_CANVAS_PIXELS,
} from "../config.js";

export function clampExportDimensions(width, height) {
  let w = Math.max(1, Math.floor(Number(width)));
  let h = Math.max(1, Math.floor(Number(height)));
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    return { width: 1, height: 1, clamped: true };
  }
  const origW = w;
  const origH = h;
  let clamped = false;
  const longEdge = Math.max(w, h);
  if (longEdge > MAX_EXPORT_CANVAS_EDGE) {
    const scale = MAX_EXPORT_CANVAS_EDGE / longEdge;
    w = Math.max(1, Math.floor(w * scale));
    h = Math.max(1, Math.floor(h * scale));
    clamped = true;
  }
  const pixels = w * h;
  if (pixels > MAX_EXPORT_CANVAS_PIXELS) {
    const scale = Math.sqrt(MAX_EXPORT_CANVAS_PIXELS / pixels);
    w = Math.max(1, Math.floor(w * scale));
    h = Math.max(1, Math.floor(h * scale));
    clamped = true;
  }
  return {
    width: w,
    height: h,
    clamped: clamped || w !== origW || h !== origH,
  };
}

export function scaleDimensionsToMaxLongEdge(width, height, maxLongEdge) {
  let w = Math.max(1, Math.floor(Number(width)));
  let h = Math.max(1, Math.floor(Number(height)));
  if (!Number.isFinite(w) || !Number.isFinite(h) || maxLongEdge <= 0) {
    return { width: w, height: h, scaled: false };
  }
  const longEdge = Math.max(w, h);
  if (longEdge <= maxLongEdge) {
    return { width: w, height: h, scaled: false };
  }
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.floor(w * scale)),
    height: Math.max(1, Math.floor(h * scale)),
    scaled: true,
  };
}

export function getBaseLayoutDimensions(layout, images) {
  if (!layout?.rects?.length || !images.length) return { width: 1, height: 1 };

  const limits = layout.rects.map((rect) => {
    const image = images[rect.imageIndex];
    if (!image) return { maxW: 1, maxH: 1 };
    return {
      maxW: image.width / rect.w,
      maxH: image.height / rect.h,
    };
  });

  const rawWidth = Math.max(1, Math.floor(Math.min(...limits.map((limit) => limit.maxW))));
  const rawHeight = Math.max(1, Math.floor(Math.min(...limits.map((limit) => limit.maxH))));

  if (layout.aspectRatio) {
    const width = Math.max(1, Math.min(rawWidth, Math.floor(rawHeight * layout.aspectRatio)));
    const height = Math.max(1, Math.floor(width / layout.aspectRatio));
    return { width, height };
  }

  return { width: rawWidth, height: rawHeight };
}

export function getExportDimensionsForLayout(layout, images) {
  const raw = getBaseLayoutDimensions(layout, images);
  const clamped = clampExportDimensions(raw.width, raw.height);
  const discordScaled = scaleDimensionsToMaxLongEdge(
    clamped.width,
    clamped.height,
    MAX_DISCORD_LONG_EDGE
  );
  const longEdge = Math.max(discordScaled.width, discordScaled.height);
  if (longEdge >= MIN_DISCORD_LONG_EDGE) {
    return {
      width: discordScaled.width,
      height: discordScaled.height,
      clamped: clamped.clamped || discordScaled.scaled,
    };
  }
  const scale = MIN_DISCORD_LONG_EDGE / longEdge;
  return {
    width: Math.max(1, Math.floor(discordScaled.width * scale)),
    height: Math.max(1, Math.floor(discordScaled.height * scale)),
    clamped: true,
  };
}

export { MAX_DISCORD_FILE_BYTES };
