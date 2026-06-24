import "dotenv/config";

export const LT3_CONTRACT_LC = "0x4ef6f6a7ee7d1cf7f1f7bfad2ba56baab868de48".toLowerCase();

export const MAX_NFT_COUNT = 110;
export const MAX_NFT_OWNER_PAGES = 250;
export const MAX_WALLET_INPUT_CHARS = 512;

export const MAX_EXPORT_CANVAS_EDGE = 8192;
export const MAX_EXPORT_CANVAS_PIXELS = MAX_EXPORT_CANVAS_EDGE * MAX_EXPORT_CANVAS_EDGE;
export const MAX_DISCORD_LONG_EDGE = 4096;
export const MIN_DISCORD_LONG_EDGE = 2048;
export const MAX_DISCORD_FILE_BYTES = 8 * 1024 * 1024;

export const BOT_VERSION = "2026-06-22-v18";
export const MAX_TOTAL_HEAVY_JOBS = Number(process.env.MAX_TOTAL_HEAVY_JOBS) || 2;
export const MAX_CONCURRENT_GRID_JOBS = Number(process.env.MAX_CONCURRENT_GRID_JOBS) || 2;
export const MAX_CONCURRENT_GIF_JOBS = Number(process.env.MAX_CONCURRENT_GIF_JOBS) || 1;
export const GRID_COOLDOWN_MS = (Number(process.env.GRID_COOLDOWN_SECONDS) || 30) * 1000;
export const GRID_TIMEOUT_MS = 180_000;
export const GIF_TIMEOUT_MS = 300_000;
export function gridTimeoutForCount(count) {
  return Math.min(600_000, 180_000 + count * 5000);
}
export function gifTimeoutForCount(count) {
  return Math.min(900_000, 240_000 + count * 8000);
}
export function gifFrameSizeForCount(_count) {
  return GIF_FRAME_SIZE;
}
export function gifFpsForCount(count) {
  if (count > 80) return 4;
  return 5;
}
export const GIF_FPS = 5;
export const GIF_FRAME_SIZE = 512;
export const IMAGE_FETCH_CONCURRENCY = 8;
export function imageFetchConcurrencyForCount(count) {
  if (count <= 30) return 20;
  if (count <= 70) return 16;
  return 12;
}
export function gridDecodeLongEdgeForCount(count) {
  if (count <= 30) return 768;
  if (count <= 50) return 896;
  if (count <= 70) return 1024;
  return 1152;
}
export function gifDecodeLongEdgeForCount(count) {
  if (count <= 30) return 768;
  if (count <= 50) return 896;
  return 1024;
}
export function renderConcurrencyForCount(count) {
  if (count <= 30) return 20;
  if (count <= 70) return 14;
  return 10;
}

export const DISCORD_TOKEN = String(process.env.DISCORD_TOKEN || "").trim();
export const DISCORD_APPLICATION_ID = String(process.env.DISCORD_APPLICATION_ID || "").trim();
export const DISCORD_GUILD_ID = String(process.env.DISCORD_GUILD_ID || "").trim();
export const DISCORD_GRID_CHANNEL_ID = String(process.env.DISCORD_GRID_CHANNEL_ID || "").trim();
export const LT3_ALCHEMY_KEY = String(process.env.LT3_ALCHEMY_KEY || "").trim();

export function assertBotConfig() {
  const missing = [];
  if (!DISCORD_TOKEN) missing.push("DISCORD_TOKEN");
  if (!DISCORD_APPLICATION_ID) missing.push("DISCORD_APPLICATION_ID");
  if (!DISCORD_GUILD_ID) missing.push("DISCORD_GUILD_ID");
  if (!LT3_ALCHEMY_KEY) missing.push("LT3_ALCHEMY_KEY");
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}
