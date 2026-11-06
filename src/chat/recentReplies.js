/** In-memory log of the bot's own recent chat replies, per channel, used to avoid repeating itself. */

const MAX_PER_CHANNEL = 6;
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** @type {Map<string, Array<{ text: string, at: number }>>} */
const byChannel = new Map();

/** @param {string} channelId */
export function getRecentReplies(channelId) {
  const list = byChannel.get(channelId);
  if (!list) return [];
  const cutoff = Date.now() - MAX_AGE_MS;
  return list.filter((r) => r.at >= cutoff).map((r) => r.text);
}

/**
 * @param {string} channelId
 * @param {string} text
 */
export function recordReply(channelId, text) {
  if (!channelId || !text?.trim()) return;
  const list = byChannel.get(channelId) ?? [];
  list.push({ text: text.trim(), at: Date.now() });
  byChannel.set(channelId, list.slice(-MAX_PER_CHANNEL));
}
