import { CHAT_MAX_CHARS } from "../config.js";

/** Tighter cap when the user wrote something short. */
export function maxCharsForInput(userText, { isGreeting = false } = {}) {
  if (isGreeting) return 90;
  const len = userText.trim().length;
  if (len <= 15) return 70;
  if (len <= 50) return 85;
  if (len <= 100) return 90;
  return CHAT_MAX_CHARS;
}
