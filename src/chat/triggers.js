const UTILITY_RE =
  /\b(utility|utilities|use case|usecase|what(?:'s| is) lt3 for|what do i get|why (?:buy|mint|collect))\b/i;
const FLOOR_RE = /\b(floor(?:\s*price)?|fp)\b/i;
/** Floor only — collection stats go through isCollectionStatsQuestion() in collectionStats.js */
const STATS_RE = /\b(collection stats|market stats|lt3 stats|opensea stats)\b/i;
/** Standalone "egg" only — not questions that mention egg names. */
const EGG_ONLY_RE = /^egg[\s.!?]*$|^🥚[\s.!?]*$/u;
/** Standalone "tyler" only — easter egg reply. */
const TYLER_ONLY_RE = /^tyler[\s.!?]*$/i;
const REDIRECT_RE =
  /\b(politics|political|election|president|congress|sec\b|securities and exchange|religion|god\b|jesus|allah|war in|genocide)\b/i;
const TRADING_RE =
  /\b(trad(e|ing)|invest(ing|ment)?|should i buy|should i sell|conviction|hold or sell|nfa|flip(ping)?)\b/i;

/** Standalone greetings only — not "gm fam how are lt3s". */
const GREETING_RE =
  /^(?:gm+|gn+|good morning|good night|morning|hey+(?:\s+there)?|hi+(?:\s+there)?|hello+(?:\s+there)?|yo+|sup|what's up|whats up)[\s.!?]*$/i;

/** Fallback if the LLM fails on a simple greeting — hi + a small varied comment. */
const GREETING_FALLBACK_POOL = [
  "Hey.",
  "Hi.",
  "Gm.",
  "Yo.",
  "Morning.",
  "Hey hey.",
];

export const SCRIPTED = {
  utility:
    'It\'s simple. When u have your nft, set it as pfp. Other girls will see it and be like "wow where did u get this" and they will spam your dms.',
  redirect: "Not my lane. Art, community, growth. Ask me about those.",
  tradingFallback:
    "Research builds conviction. Hold what you believe in. NFA.",
  noApiKey: "Chat brain offline. Grid and gif still work.",
  empty: "Tag me with something to chew on.",
};

export function matchEgg(text) {
  return EGG_ONLY_RE.test(text.trim());
}

export function pickGreetingFallback(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  }
  return GREETING_FALLBACK_POOL[h % GREETING_FALLBACK_POOL.length];
}

export function matchScriptedTrigger(text) {
  const t = text.trim();
  if (!t) return { kind: "empty" };
  if (EGG_ONLY_RE.test(t)) return { kind: "egg" };
  if (TYLER_ONLY_RE.test(t)) return { kind: "tyler" };
  if (GREETING_RE.test(t)) return { kind: "greeting" };
  if (REDIRECT_RE.test(t)) return { kind: "redirect", reply: SCRIPTED.redirect };
  if (UTILITY_RE.test(t)) return { kind: "utility", reply: SCRIPTED.utility };
  if (FLOOR_RE.test(t) || STATS_RE.test(t)) return { kind: "stats" };
  if (TRADING_RE.test(t)) return { kind: "trading" };
  return null;
}
