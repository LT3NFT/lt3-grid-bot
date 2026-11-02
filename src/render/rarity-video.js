import { spawn } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import puppeteer from "puppeteer";
import {
  MAX_DISCORD_FILE_BYTES,
  RARITY_FPS,
  RARITY_HEIGHT,
  RARITY_PAGE_URL,
  RARITY_TIMEOUT_MS,
  RARITY_WIDTH,
} from "../config.js";

const SUPPLY = 5555;
const FRAMES_PER_BATCH = 8;
const JPEG_QUALITY = 0.88;

/** Larger CRF / smaller frame on each retry until the MP4 fits Discord's upload cap. */
function encodeTargets(exportHeight) {
  return [
    { crf: 23, height: exportHeight },
    { crf: 26, height: Math.min(exportHeight, 720) },
    { crf: 28, height: 540 },
  ];
}

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--mute-audio",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-background-networking",
          "--js-flags=--max-old-space-size=512",
        ],
      })
      .then((browser) => {
        browser.on("disconnected", () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

/** Same rules as the Rarity Breakdown input: "4449", "#4449", "LT3 #4449". */
export function parseRarityTokenId(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/(\d{1,5})\s*$/) || s.match(/#\s*(\d{1,5})/);
  if (!m) return null;
  const id = Number(m[1]);
  return id >= 1 && id <= SUPPLY ? String(id) : null;
}

/**
 * Runs the tool's own load() for the token, then switches the canvas to export size.
 * Everything referenced here (els, state, load, stopPreview, ...) is the page's top-level script scope.
 */
async function prepareBreakdown(page, tokenId, width, height) {
  return page.evaluate(
    async (id, w, h) => {
      els.tokenInput.value = id;
      await load();
      if (!state.ready || state.tokenId !== id) {
        return { ok: false, error: els.status.textContent || `Could not load LT3 #${id}.` };
      }
      stopPreview();
      exporting = true;
      canvas.width = w;
      canvas.height = h;
      sceneCache = null;
      sceneKey = "";
      fieldCache = null;
      fieldKey = "";
      return {
        ok: true,
        durationSec: state.durationSec,
        rank: state.rank,
        total: state.total,
        band: state.band,
        layers: state.cards.length,
      };
    },
    tokenId,
    width,
    height
  );
}

async function captureFrames(page, durationSec, fps, width, height) {
  const frameCount = Math.max(2, Math.round(durationSec * fps));
  const frames = [];
  for (let start = 0; start <= frameCount; start += FRAMES_PER_BATCH) {
    const end = Math.min(frameCount, start + FRAMES_PER_BATCH - 1);
    const batch = await page.evaluate(
      (from, to, total, dur, w, h, quality) => {
        const out = [];
        for (let f = from; f <= to; f += 1) {
          paint((f / total) * dur, w, h);
          out.push(canvas.toDataURL("image/jpeg", quality).slice("data:image/jpeg;base64,".length));
        }
        return out;
      },
      start,
      end,
      frameCount,
      durationSec,
      width,
      height,
      JPEG_QUALITY
    );
    for (const b64 of batch) frames.push(Buffer.from(b64, "base64"));
  }
  return frames;
}

function encodeMp4(frames, fps, { crf, height }, exportHeight, outPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-f", "image2pipe",
      "-c:v", "mjpeg",
      "-framerate", String(fps),
      "-i", "pipe:0",
      ...(height !== exportHeight ? ["-vf", `scale=-2:${height}:flags=lanczos`] : []),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", String(crf),
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outPath,
    ];
    const proc = spawn(process.env.FFMPEG_PATH || "ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new Error("ffmpeg is not installed on the server — contact the team."));
        return;
      }
      reject(err);
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-400)}`));
    });

    (async () => {
      for (const frame of frames) {
        if (!proc.stdin.write(frame)) {
          await new Promise((res) => proc.stdin.once("drain", res));
        }
      }
      proc.stdin.end();
    })().catch((err) => {
      proc.kill("SIGKILL");
      reject(err);
    });
  });
}

async function renderRarityVideo(tokenId) {
  const width = Math.max(640, Math.floor(RARITY_WIDTH));
  const height = Math.max(360, Math.floor(RARITY_HEIGHT));
  const fps = Math.max(10, Math.min(30, Math.floor(RARITY_FPS)));

  const browser = await getBrowser();
  const page = await browser.newPage();
  const workDir = await mkdtemp(path.join(tmpdir(), "lt3-rarity-"));
  try {
    await page.setViewport({ width: 960, height: 720, deviceScaleFactor: 1 });
    page.setDefaultTimeout(120_000);
    await page.goto(RARITY_PAGE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const info = await prepareBreakdown(page, tokenId, width, height);
    if (!info.ok) throw new Error(info.error);

    const started = Date.now();
    const frames = await captureFrames(page, info.durationSec, fps, width, height);
    console.log(
      `[rarity] #${tokenId}: ${frames.length} frames @ ${fps}fps ${width}x${height} captured in ${Date.now() - started}ms`
    );
    await page.close();

    const outPath = path.join(workDir, `lt3-rarity-breakdown-${tokenId}.mp4`);
    for (const target of encodeTargets(height)) {
      await encodeMp4(frames, fps, target, height, outPath);
      const buffer = await readFile(outPath);
      console.log(`[rarity] #${tokenId}: crf ${target.crf} @ ${target.height}p → ${buffer.length} bytes`);
      if (buffer.length <= MAX_DISCORD_FILE_BYTES) {
        return {
          buffer,
          filename: `lt3-rarity-breakdown-${tokenId}.mp4`,
          tokenId,
          rank: info.rank,
          total: info.total,
          band: info.band,
        };
      }
    }
    throw new Error(`LT3 #${tokenId}'s breakdown came out too large for Discord.`);
  } finally {
    if (!page.isClosed()) await page.close().catch(() => {});
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function buildRarityVideoWithTimeout(tokenId) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("The rarity breakdown took too long — try again in a minute.")),
      RARITY_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([renderRarityVideo(tokenId), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
