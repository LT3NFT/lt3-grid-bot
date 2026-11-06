import puppeteer from "puppeteer";
import sharp from "sharp";
import {
  MAX_DISCORD_FILE_BYTES,
  RARITY_HEIGHT,
  RARITY_PAGE_URL,
  RARITY_TIMEOUT_MS,
  RARITY_WIDTH,
} from "../config.js";

const SUPPLY = 5555;
/** Chrome holds a few hundred MB, so let it go when nobody has asked for a while. */
const IDLE_CLOSE_MS = 20 * 60 * 1000;
/** Reload the tool page now and then so site updates reach the bot. */
const PAGE_MAX_AGE_MS = 60 * 60 * 1000;

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
 * Load the token on the live tool page, then paint the same still frame Export PNG uses
 * (`stillFrame = true` at `outroAt() - 0.01` — every card landed, before the fall).
 */
async function prepareAndCaptureStill(page, tokenId, width, height) {
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

      stillFrame = true;
      paint(outroAt() - 0.01, w, h);
      stillFrame = false;

      const dataUrl = canvas.toDataURL("image/png");
      return {
        ok: true,
        pngBase64: dataUrl.slice("data:image/png;base64,".length),
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

async function fitDiscordPng(pngBuffer) {
  if (pngBuffer.length <= MAX_DISCORD_FILE_BYTES) {
    return { buffer: pngBuffer, extension: "png", mime: "image/png" };
  }

  let quality = 92;
  while (quality >= 70) {
    const jpg = await sharp(pngBuffer).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpg.length <= MAX_DISCORD_FILE_BYTES) {
      return { buffer: jpg, extension: "jpg", mime: "image/jpeg" };
    }
    quality -= 8;
  }

  const scaled = await sharp(pngBuffer)
    .resize({ width: Math.floor(RARITY_WIDTH * 0.85), withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  return { buffer: scaled, extension: "jpg", mime: "image/jpeg" };
}

/**
 * @param {string} tokenId
 * @param {(stage: { step: "open" | "load" | "still" }) => void} [onProgress]
 */
async function renderRarityStill(tokenId, onProgress) {
  const width = Math.max(640, Math.floor(RARITY_WIDTH));
  const height = Math.max(360, Math.floor(RARITY_HEIGHT));
  const t0 = Date.now();
  const timings = [];
  const mark = (label) => timings.push(`${label} ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  clearTimeout(idleTimer);
  onProgress?.({ step: "open" });
  let { page, warm } = await getToolPage();
  mark(warm ? "page(warm)" : "page(cold)");

  try {
    onProgress?.({ step: "load" });
    let info;
    try {
      info = await prepareAndCaptureStill(page, tokenId, width, height);
    } catch (err) {
      if (!warm) throw err;
      console.warn("[rarity] warm page failed, reloading", err?.message);
      warmPage = null;
      ({ page } = await getToolPage());
      info = await prepareAndCaptureStill(page, tokenId, width, height);
    }
    if (!info.ok) throw new Error(info.error);
    mark("layers+still");

    onProgress?.({ step: "still" });
    const raw = Buffer.from(info.pngBase64, "base64");
    const fitted = await fitDiscordPng(raw);
    mark(`${fitted.extension} ${(fitted.buffer.length / 1048576).toFixed(2)}MB`);
    console.log(`[rarity] #${tokenId} still ${width}x${height} — ${timings.join(" · ")}`);

    return {
      buffer: fitted.buffer,
      filename: `lt3-rarity-breakdown-${tokenId}.${fitted.extension}`,
      tokenId,
      rank: info.rank,
      total: info.total,
      band: info.band,
      mime: fitted.mime,
    };
  } catch (err) {
    console.error(`[rarity] #${tokenId} failed after ${timings.join(" · ") || "start"}`);
    throw err;
  } finally {
    scheduleIdleClose();
  }
}

export async function buildRarityVideoWithTimeout(tokenId, onProgress) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      void closeBrowser();
      reject(new Error("The rarity breakdown took too long — try again in a minute."));
    }, RARITY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([renderRarityStill(tokenId, onProgress), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export { closeBrowser as closeRarityBrowser };
