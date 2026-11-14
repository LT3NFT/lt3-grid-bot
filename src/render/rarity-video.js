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
/** Serialize page open / reload so pre-warm and /rarity never race. */
let pageGate = Promise.resolve();

function getBrowser() {
  if (!browserPromise) {
    const launchOpts = {
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
    };
    const chromePath = String(process.env.PUPPETEER_EXECUTABLE_PATH || "").trim();
    if (chromePath) launchOpts.executablePath = chromePath;

    browserPromise = puppeteer
      .launch(launchOpts)
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
  const run = pageGate.then(async () => {
    if (warmPage && !warmPage.isClosed() && Date.now() - warmPageLoadedAt < PAGE_MAX_AGE_MS) {
      return { page: warmPage, warm: true };
    }
    if (warmPage && !warmPage.isClosed()) await warmPage.close().catch(() => {});
    warmPage = null;

    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 720, deviceScaleFactor: 1 });
    page.setDefaultTimeout(60_000);
    console.log(`[rarity] loading tool page ${RARITY_PAGE_URL}`);
    await page.goto(RARITY_PAGE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForFunction(() => typeof load === "function" && typeof paint === "function", {
      timeout: 30_000,
    });
    warmPage = page;
    warmPageLoadedAt = Date.now();
    return { page, warm: false };
  });
  pageGate = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Launch Chrome + tool page in the background so the first /rarity is not a cold start. */
export async function warmRarityBrowser() {
  clearTimeout(idleTimer);
  const { warm } = await getToolPage();
  scheduleIdleClose();
  console.log(`[rarity] browser ${warm ? "already warm" : "pre-warmed"}`);
  return !warm;
}

/** Map Puppeteer / Chrome noise to a short Discord-safe line. */
export function friendlyRarityError(err) {
  const raw = err instanceof Error ? err.message : String(err || "");
  const msg = raw.replace(/\s+/g, " ").trim();
  if (!msg) return "Something went wrong while building the breakdown. Try again in a minute.";
  if (/took too long|timeout|timed out|Navigation timeout|Waiting for|TimeoutError/i.test(msg)) {
    return "The rarity breakdown took too long — try again in a minute.";
  }
  if (/Target closed|Session closed|Protocol error|Browser\.close|net::ERR|detached Frame/i.test(msg)) {
    return "The breakdown engine hiccuped — try again in a minute.";
  }
  if (/Could not load LT3|Enter an LT3|Invalid LT3/i.test(msg)) return msg;
  if (msg.length <= 140 && !/at\s+\S+\s+\(/.test(msg) && !/ProtocolError/i.test(msg)) return msg;
  return "Something went wrong while building the breakdown. Try again in a minute.";
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
      warmPage = null;
      void closeBrowser();
      reject(new Error("The rarity breakdown took too long — try again in a minute."));
    }, RARITY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([renderRarityStill(tokenId, onProgress), timeout]);
  } catch (err) {
    // Drop a poisoned warm page so the next request cold-starts cleanly.
    if (warmPage) {
      await warmPage.close().catch(() => {});
      warmPage = null;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Drive lt3tools "Export MP4" (MediaRecorder) and return the recorded blob.
 * Headless Chrome usually yields webm; callers may remux to H.264 MP4 for X.
 * @param {string} tokenId
 * @param {(stage: { step: string }) => void} [onProgress]
 */
async function renderRarityMp4(tokenId, onProgress) {
  const id = parseRarityTokenId(tokenId);
  if (!id) throw new Error(`Invalid LT3 token id for rarity video: ${tokenId}`);

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
      info = await prepareTokenOnPage(page, id);
    } catch (err) {
      if (!warm) throw err;
      console.warn("[rarity] warm page failed (mp4), reloading", err?.message);
      warmPage = null;
      ({ page } = await getToolPage());
      info = await prepareTokenOnPage(page, id);
    }
    if (!info.ok) throw new Error(info.error);
    mark("layers");

    onProgress?.({ step: "record" });
    const captured = await recordExportMp4(page);
    mark(`${captured.extension} ${(captured.buffer.length / 1048576).toFixed(2)}MB`);
    console.log(`[rarity] #${id} mp4-export — ${timings.join(" · ")}`);

    return {
      buffer: captured.buffer,
      filename: `lt3-rarity-breakdown-${id}.${captured.extension}`,
      tokenId: id,
      rank: info.rank,
      total: info.total,
      band: info.band,
      mime: captured.mime,
    };
  } catch (err) {
    console.error(`[rarity] #${id} mp4 failed after ${timings.join(" · ") || "start"}`);
    throw err;
  } finally {
    scheduleIdleClose();
  }
}

/** Load token + ready state without painting the still frame. */
async function prepareTokenOnPage(page, tokenId) {
  return page.evaluate(async (id) => {
    exporting = false;
    els.tokenInput.value = id;
    await load();
    stopPreview();
    if (!state.ready || state.tokenId !== id) {
      return { ok: false, error: els.status.textContent || `Could not load LT3 #${id}.` };
    }
    return {
      ok: true,
      rank: state.rank,
      total: state.total,
      band: state.band,
      layers: state.cards.length,
      durationSec: state.durationSec,
    };
  }, tokenId);
}

/** Drive the same MediaRecorder path as lt3tools Export MP4; return encoded bytes. */
async function recordExportMp4(page) {
  const result = await page.evaluate(async () => {
    if (!state.ready) throw new Error("Token not ready for Export MP4.");
    if (typeof MediaRecorder === "undefined") {
      throw new Error("This Chrome build cannot record video (no MediaRecorder).");
    }

    const mime =
      [
        "video/mp4;codecs=avc1.42E01E",
        "video/mp4",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    if (!mime) throw new Error("No supported MediaRecorder mime type.");

    const EXPORT_W = 1920;
    const EXPORT_H = 1080;
    const EXPORT_FPS = 60;
    const waitFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const sleepUntil = async (slotTime) => {
      while (performance.now() < slotTime) {
        const left = slotTime - performance.now();
        if (left > 10) await new Promise((r) => setTimeout(r, Math.min(left - 2, 40)));
        else await waitFrame();
      }
    };

    stopPreview();
    exporting = true;
    const prevW = canvas.width;
    const prevH = canvas.height;
    canvas.width = EXPORT_W;
    canvas.height = EXPORT_H;
    sceneCache = null;
    sceneKey = "";

    const fps = EXPORT_FPS;
    const durationSec = state.durationSec;
    const frameCount = Math.max(2, Math.round(durationSec * fps));
    const wallMs = (frameCount / fps) * 1000;

    paint(0, EXPORT_W, EXPORT_H);
    await waitFrame();

    let stream = canvas.captureStream(0);
    let track = stream.getVideoTracks()[0];
    if (typeof track?.requestFrame !== "function") {
      stream.getTracks().forEach((t) => t.stop());
      stream = canvas.captureStream(fps);
      track = stream.getVideoTracks()[0];
    }
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14_000_000 });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    const done = new Promise((resolve) => {
      recorder.onstop = () => resolve();
    });
    const pushFrame = () => {
      if (track.requestFrame) {
        try {
          track.requestFrame();
        } catch (_) {}
      }
    };

    recorder.start(100);
    await waitFrame();
    pushFrame();
    await waitFrame();

    const wallStart = performance.now();
    for (let frame = 0; frame <= frameCount; frame++) {
      await sleepUntil(wallStart + (frame / frameCount) * wallMs);
      paint((frame / frameCount) * durationSec, EXPORT_W, EXPORT_H);
      pushFrame();
      await waitFrame();
    }
    paint(durationSec, EXPORT_W, EXPORT_H);
    pushFrame();
    await new Promise((r) => setTimeout(r, 180));
    pushFrame();
    await waitFrame();

    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    await done;

    exporting = false;
    canvas.width = prevW;
    canvas.height = prevH;
    sceneCache = null;
    sceneKey = "";
    fieldCache = null;
    fieldKey = "";
    syncPreviewSize();

    const blob = new Blob(chunks, { type: mime });
    if (blob.size < 2048) throw new Error("Export MP4 produced an empty file.");

    const ab = await blob.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let binary = "";
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      binary += String.fromCharCode(...bytes.subarray(i, i + step));
    }
    return {
      mime: blob.type || mime,
      b64: btoa(binary),
      extension: (blob.type || mime).includes("mp4") ? "mp4" : "webm",
    };
  });

  return {
    buffer: Buffer.from(result.b64, "base64"),
    mime: result.mime,
    extension: result.extension,
  };
}

/** Editorial / X path — rarity breakdown video (tool Export MP4). Longer than still. */
export async function buildRarityMp4WithTimeout(tokenId, onProgress) {
  const timeoutMs = Math.max(RARITY_TIMEOUT_MS, 300_000);
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      void closeBrowser();
      reject(new Error("The rarity breakdown video took too long — try again in a minute."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([renderRarityMp4(tokenId, onProgress), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export { closeBrowser as closeRarityBrowser };
