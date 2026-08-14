import { CHAT_MAX_CHARS } from "../config.js";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu;

/** Enforce LT3BOT chat output rules. */
export function sanitizeChatReply(raw, { allowEgg = false, maxChars = CHAT_MAX_CHARS } = {}) {
  if (!raw || typeof raw !== "string") return "Say that again. I lost the signal.";

  let text = raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(/!/g, ".");
  if (!allowEgg) text = text.replace(EMOJI_RE, "").trim();

  if (text.length > maxChars) {
    const cut = text.slice(0, maxChars);
    const lastSpace = cut.lastIndexOf(" ");
    text = (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim();
  }

  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text || "Say that again. I lost the signal.";
}
