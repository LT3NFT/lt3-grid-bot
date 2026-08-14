import { CHAT_MAX_CHARS } from "../config.js";

function isConversational(text) {
  const t = text.trim();
  if (t.includes("?")) return true;
  if (t.length > 35) return true;
  return /\b(what|how|why|who|when|where)\b/i.test(t);
}

/** Tighter cap when the user wrote something short. */
export function maxCharsForInput(userText, { isGreeting = false } = {}) {
  const trimmed = userText.trim();
  const len = trimmed.length;
  const conversational = isConversational(trimmed);

  if (isGreeting) return 95;
  if (conversational) return 120;
  if (len <= 15) return 85;
  if (len <= 50) return 100;
  if (len <= 100) return 110;
  return CHAT_MAX_CHARS;
}
