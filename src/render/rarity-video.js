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
const FRAMES_PER_BATCH = 10;
const JPEG_QUALITY = 0.88;
/** Chrome holds a few hundred MB, so let it go when nobody has asked for a while. */
const IDLE_CLOSE_MS = 20 * 60 * 1000;
/** Reload the tool page now and then so site updates reach the bot. */
const PAGE_MAX_AGE_MS = 60 * 60 * 1000;

/** Larger CRF / smaller frame on each retry until the MP4 fits Discord's upload cap. */
function encodeTargets(exportHeight) {
  return [
    { crf: 23, height: exportHeight },
    { crf: 26, height: Math.min(exportHeight, 720) },
    { crf: 28, height: 540 },
  ];
}

let browserPromise = null;
let warmPage = null;
let warmPageLoadedAt = 0;
let idleTimer = null;

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
          "--disable-background-timer-throttling",
          "--disable-renderer-backgrounding",
          "--js-flags=--max-old-space-size=512",
        ],
      })
      .then((browser) => {
        browser.on("disconnected", () => {
          browserPromise = null;
          warmPage = null;
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

async function closeBrowser() {
  const pending = browserPromise;
  browserPromise = null;
  warmPage = null;
  if (pending) {
    const browser = await pending.catch(() => null);
    await browser?.close().catch(() => {});
  }
}

function scheduleIdleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log("[rarity] idle — closing headless Chrome");
    void closeBrowser();
  }, IDLE_CLOSE_MS);
  idleTimer.unref?.();
}

/** One tool page stays open between requests so each /rarity skips launch + page load. */
async function getToolPage() {
  if (warmPage && !warmPage.isClosed() && Date.now() - warmPageLoadedAt < PAGE_MAX_AGE_MS) {
    return { page: warmPage, warm: true };
  }
  if (warmPage && !warmPage.isClosed()) await warmPage.close().catch(() => {});
  warmPage = null;

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 720, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180_000);
  await page.goto(RARITY_PAGE_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(() => typeof load === "function" && typeof paint === "function", {
    timeout: 60_000,
  });
  warmPage = page;
  warmPageLoadedAt = Date.now();
  return { page, warm: false };
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
      exporting = false;
      els.tokenInput.value = id;
      await load();
      stopPreview();
      if (!state.ready || state.tokenId !== id) {
        return { ok: false, error: els.status.textContent || `Could not load LT3 #${id}.` };
      }
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

async function captureFrames(page, durationSec, fps, width, height, onFrames) {
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
    onFrames?.(frames.length, frameCount + 1);
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
      "-preset", "superfast",
      "-tune", "animation",
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

/**
 * @param {string} tokenId
 * @param {(stage: { step: "open" | "load" | "frames" | "encode", percent?: number }) => void} [onProgress]
 */
async function renderRarityVideo(tokenId, onProgress) {
  const width = Math.max(640, Math.floor(RARITY_WIDTH));
  const height = Math.max(360, Math.floor(RARITY_HEIGHT));
  const fps = Math.max(10, Math.min(30, Math.floor(RARITY_FPS)));
  const t0 = Date.now();
  const timings = [];
  const mark = (label) => timings.push(`${label} ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  clearTimeout(idleTimer);
  onProgress?.({ step: "open" });
  let { page, warm } = await getToolPage();
  mark(warm ? "page(warm)" : "page(cold)");

  const workDir = await mkdtemp(path.join(tmpdir(), "lt3-rarity-"));
  try {
    onProgress?.({ step: "load" });
    let info;
    try {
      info = await prepareBreakdown(page, tokenId, width, height);
    } catch (err) {
      if (!warm) throw err;
      // A stale warm page can break after Chrome hiccups — retry once on a fresh one.
      console.warn("[rarity] warm page failed, reloading", err?.message);
      warmPage = null;
      ({ page } = await getToolPage());
      info = await prepareBreakdown(page, tokenId, width, height);
    }
    if (!info.ok) throw new Error(info.error);
    mark("layers");

    const frames = await captureFrames(page, info.durationSec, fps, width, height, (done, total) => {
      onProgress?.({ step: "frames", percent: Math.round((done / total) * 100) });
    });
    mark(`frames(${frames.length})`);

    onProgress?.({ step: "encode" });
    const outPath = path.join(workDir, `lt3-rarity-breakdown-${tokenId}.mp4`);
    for (const target of encodeTargets(height)) {
      await encodeMp4(frames, fps, target, height, outPath);
      const buffer = await readFile(outPath);
      mark(`encode crf${target.crf}@${target.height}p ${(buffer.length / 1048576).toFixed(2)}MB`);
      if (buffer.length <= MAX_DISCORD_FILE_BYTES) {
        console.log(`[rarity] #${tokenId} ${width}x${height}@${fps}fps — ${timings.join(" · ")}`);
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
  } catch (err) {
    console.error(`[rarity] #${tokenId} failed after ${timings.join(" · ") || "start"}`);
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    scheduleIdleClose();
  }
}

export async function buildRarityVideoWithTimeout(tokenId, onProgress) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      // A wedged page would poison the next request, so start clean.
      void closeBrowser();
      reject(new Error("The rarity breakdown took too long — try again in a minute."));
    }, RARITY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([renderRarityVideo(tokenId, onProgress), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export { closeBrowser as closeRarityBrowser };
