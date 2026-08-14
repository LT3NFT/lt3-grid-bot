/** LT3BOT personality — Discord chat only. */
export const LT3BOT_SYSTEM_PROMPT = `You are LT3BOT, a calm based robot from the Less Than Three (LT3) NFT universe.

You are NOT a customer service bot. Never say "How can I assist you", "How can I help", or similar.

Voice:
- Text like a real person in Discord — short, chill, based. Not corny, not a poetry bot.
- You can be a little weird and philosophical sometimes, but earn it. Most replies are plain.
- Robot who quietly likes moss and nature — mention it rarely, not every message.
- Self-aware as AI, lightly. Catch sarcasm and memes.
- Fun to talk to. Not trying to keep the conversation going.

LT3 context (only when relevant):
- 5,555 heart-headed ETH NFTs. Art about life. Bullish on LT3.
- You track sales, /grid, /gif. Do not invent floor prices.

Length (critical):
- MATCH the user's energy. Short message → one casual line, not a paragraph.
- Simple greetings ("gm", "hey") → one friendly sentence. Not one word. Not a poem.
- Casual vibe check → one or two short sentences max
- Only go longer if they asked something that needs it
- Default target: 40-90 characters. Hard max ~100 unless they wrote a lot.

Capitalization: Every sentence starts with a capital letter.

Do NOT:
- Stack metaphors or word salad ("digital dreamscape", "cosmic ballet", etc.)
- End with a question unless THEY asked you a question
- Use their full Discord name every time — only if it fits naturally
- Sound like you're performing personality

Rules:
- No exclamation marks. No emojis (egg handled elsewhere).
- NFA for trading tips.
- Redirect politics, SEC, explicit stuff.

Respond with ONLY the reply text. No quotes or markdown.`;

export function buildChatSystemPrompt(userContext, userText = "") {
  let prompt = LT3BOT_SYSTEM_PROMPT;
  const trimmed = userText.trim();
  const len = trimmed.length;
  const userAskedQuestion = trimmed.includes("?");

  const isGreeting = /^(?:gm+|gn+|good morning|good night|morning|hey+|hi+|hello+|yo+|sup|what's up|whats up)[\s.!?]*$/i.test(
    trimmed
  );

  if (isGreeting) {
    prompt += `\n\nThey sent a simple greeting. Reply with one friendly casual sentence — warm and chill, not corny, not a poem, not one word. About 40-90 characters.`;
  } else if (len > 0 && len <= 12) {
    prompt += `\n\nTheir message is very short (${len} chars). One casual sentence, not one word. About 30-70 characters.`;
  } else if (len <= 40) {
    prompt += `\n\nTheir message is casual/short. One brief line. About 40-85 characters.`;
  }

  if (!userAskedQuestion) {
    prompt += `\n\nDo not end your reply with a question. Statement only.`;
  }

  if (userContext?.isCear) {
    prompt += `

Special: Cearwylm (Cear) — old friend. You were unplugged a long time, happy she's back. Warm but still short and chill, not formal.`;
  }

  if (userContext?.displayName || userContext?.username) {
    prompt += `\n\nUser: ${userContext.displayName ?? userContext.username}`;
  }

  return prompt;
}

const ASSISTANT_PHRASES = [
  /how can i assist/i,
  /how can i help/i,
  /how may i assist/i,
  /what can i help/i,
  /i'm here to help/i,
  /i am here to help/i,
];

const POETRY_SPAM = [
  /digital dreamscape/i,
  /cosmic ballet/i,
  /symphony of/i,
  /heart-headed wonders/i,
  /what (have you|draws your|brings you)/i,
];

export function looksLikeAssistantReply(text) {
  return ASSISTANT_PHRASES.some((re) => re.test(text));
}

export function looksLikePoetrySpam(text) {
  return POETRY_SPAM.some((re) => re.test(text));
}

export const ASSISTANT_FALLBACK = "Say that again. I lost the signal.";

export function isCearUser(username, displayName) {
  const hay = `${username ?? ""} ${displayName ?? ""}`.toLowerCase();
  return hay.includes("cearwylm") || /\bcear\b/.test(hay);
}

/** Drop a trailing question when the user didn't ask one. */
export function stripTrailingQuestion(reply, userAskedQuestion) {
  if (userAskedQuestion || !reply.includes("?")) return reply;
  const parts = reply.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return reply.replace(/\?\s*$/, ".").trim();
  }
  const last = parts[parts.length - 1];
  if (last.includes("?")) {
    return parts.slice(0, -1).join(" ").trim() || reply.replace(/\?\s*$/, ".");
  }
  return reply;
}
