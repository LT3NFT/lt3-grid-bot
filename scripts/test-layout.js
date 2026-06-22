import { generateLayouts } from "../src/layout/generate.js";
import { pickBestLayout } from "../src/layout/rank.js";
import { getExportDimensionsForLayout } from "../src/layout/dimensions.js";
import { renderLayoutToBuffer } from "../src/render/composite.js";
import fs from "fs";
import path from "path";

function makeImages(count) {
  return Array.from({ length: count }, (_, i) => ({
    name: `mock-${i + 1}`,
    width: 1000,
    height: 1000,
    buffer: Buffer.alloc(0),
  }));
}

const counts = [2, 4, 6, 9, 12, 16, 20, 25, 47];
for (const count of counts) {
  const images = makeImages(count);
  const layouts = generateLayouts(images);
  const layout = pickBestLayout(layouts);
  const dims = getExportDimensionsForLayout(layout, images);
  console.log(`${count} -> ${layout.name} (aspect ${layout.aspectRatio?.toFixed(2)}) ${dims.width}x${dims.height}`);
}

const outDir = path.join(process.cwd(), "output");
fs.mkdirSync(outDir, { recursive: true });

const fourImages = makeImages(4).map((img) => ({
  ...img,
  buffer: Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#${Math.floor(Math.random()*16777215).toString(16).padStart(6,"0")}"/></svg>`
  ),
}));

const layout4 = pickBestLayout(generateLayouts(fourImages));
const dims4 = getExportDimensionsForLayout(layout4, fourImages);
const rendered = await renderLayoutToBuffer(layout4, fourImages, dims4.width, dims4.height);
fs.writeFileSync(path.join(outDir, "test-4.png"), rendered.buffer);
console.log(`Wrote output/test-4.png (${rendered.extension}, ${rendered.buffer.length} bytes)`);
