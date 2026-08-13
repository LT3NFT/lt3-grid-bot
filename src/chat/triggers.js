const UTILITY_RE =
  /\b(utility|utilities|use case|usecase|what(?:'s| is) lt3 for|what do i get|why (?:buy|mint|collect))\b/i;
const FLOOR_RE = /\b(floor(?:\s*price)?|fp)\b/i;
const EGG_RE = /\begg\b/i;
const REDIRECT_RE =
  /\b(politics|political|election|president|congress|sec\b|securities and exchange|religion|god\b|jesus|allah|war in|genocide)\b/i;
const TRADING_RE =
  /\b(trad(e|ing)|invest(ing|ment)?|should i buy|should i sell|conviction|hold or sell|nfa|flip(ping)?)\b/i;

export const SCRIPTED = {
  utility:
    "It's simple. Set your nft as pfp. Others notice. Dms follow.",
  redirect: "Not my lane. Art, community, growth — ask me about those.",
  tradingFallback:
    "Research builds conviction. Hold what you believe in. NFA.",
  noApiKey: "Chat brain offline. Grid and gif still work.",
  empty: "Tag me with something to chew on.",
};

export function matchEgg(text) {
  return EGG_RE.test(text);
}

export function matchScriptedTrigger(text) {
  const t = text.trim();
  if (!t) return { kind: "empty" };
  if (EGG_RE.test(t)) return { kind: "egg" };
  if (REDIRECT_RE.test(t)) return { kind: "redirect", reply: SCRIPTED.redirect };
  if (UTILITY_RE.test(t)) return { kind: "utility", reply: SCRIPTED.utility };
  if (FLOOR_RE.test(t)) return { kind: "floor" };
  if (TRADING_RE.test(t)) return { kind: "trading" };
  return null;
}
