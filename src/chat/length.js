import { CHAT_MAX_CHARS } from "../config.js";

/** Tighter cap when the user wrote something short. */
export function maxCharsForInput(userText) {
  const len = userText.trim().length;
  if (len <= 15) return 22;
  if (len <= 50) return 55;
  if (len <= 100) return 90;
  return CHAT_MAX_CHARS;
}
