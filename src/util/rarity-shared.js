/** Shared rarity helpers — no Puppeteer import (safe for the Discord gateway process). */

const SUPPLY = 5555;

/** Same rules as the Rarity Breakdown input: "4449", "#4449", "LT3 #4449". */
export function parseRarityTokenId(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/(\d{1,5})\s*$/) || s.match(/#\s*(\d{1,5})/);
  if (!m) return null;
  const id = Number(m[1]);
  return id >= 1 && id <= SUPPLY ? String(id) : null;
}

/** Map Puppeteer / Chrome noise to a short Discord-safe line. */
export function friendlyRarityError(err) {
  const raw = err instanceof Error ? err.message : String(err || "");
  const msg = raw.replace(/\s+/g, " ").trim();
  if (!msg) return "Something went wrong while building the breakdown. Try again in a minute.";
  if (/took too long|timeout|timed out|Navigation timeout|Waiting for|TimeoutError/i.test(msg)) {
    return "The rarity breakdown took too long — try again in a minute.";
  }
  if (/Target closed|Session closed|Protocol error|Browser\.close|net::ERR|detached Frame|Job process/i.test(msg)) {
    return "The breakdown engine hiccuped — try again in a minute.";
  }
  if (/Could not load LT3|Enter an LT3|Invalid LT3/i.test(msg)) return msg;
  if (msg.length <= 140 && !/at\s+\S+\s+\(/.test(msg) && !/ProtocolError/i.test(msg)) return msg;
  return "Something went wrong while building the breakdown. Try again in a minute.";
}
