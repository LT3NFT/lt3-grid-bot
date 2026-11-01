import { spawn } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import puppeteer from "puppeteer";
import {
  MAX_DISCORD_FILE_BYTES,
  RARITY_FPS,
  RARITY_PAGE_URL,
  RARITY_TIMEOUT_MS,
} from "../config.js";

const SUPPLY = 5555;
const EXPORT_W = 1920;
const EXPORT_H = 1080;
const FRAMES_PER_BATCH = 12;
const JPEG_QUALITY = 0.95;

/** Larger CRF / smaller frame on each retry until the MP4 fits Discord's upload cap. */
const ENCODE_TARGETS = [
  { crf: 18, height: 1080 },
  { crf: 23, height: 1080 },
  { crf: 26, height: 720 },
];

let browserPromise = null;

function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage", "--mute-audio"],
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
async function prepareBreakdown(page, tokenId) {
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
    EXPORT_W,
    EXPORT_H
  );
}

async function captureFrames(page, durationSec, fps) {
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
      EXPORT_W,
      EXPORT_H,
      JPEG_QUALITY
    );
    for (const b64 of batch) frames.push(Buffer.from(b64, "base64"));
  }
  return frames;
}

function encodeMp4(frames, fps, { crf, height }, outPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-f", "image2pipe",
      "-c:v", "mjpeg",
      "-framerate", String(fps),
      "-i", "pipe:0",
      ...(height !== EXPORT_H ? ["-vf", `scale=-2:${height}:flags=lanczos`] : []),
      "-c:v", "libx264",
      "-preset", "medium",
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
  const browser = await getBrowser();
  const page = await browser.newPage();
  const workDir = await mkdtemp(path.join(tmpdir(), "lt3-rarity-"));
  try {
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.goto(RARITY_PAGE_URL, { waitUntil: "load", timeout: 30_000 });

    const info = await prepareBreakdown(page, tokenId);
    if (!info.ok) throw new Error(info.error);

    const started = Date.now();
    const frames = await captureFrames(page, info.durationSec, RARITY_FPS);
    console.log(
      `[rarity] #${tokenId}: ${frames.length} frames @ ${RARITY_FPS}fps captured in ${Date.now() - started}ms`
    );
    await page.close();

    const outPath = path.join(workDir, `lt3-rarity-breakdown-${tokenId}.mp4`);
    for (const target of ENCODE_TARGETS) {
      await encodeMp4(frames, RARITY_FPS, target, outPath);
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
