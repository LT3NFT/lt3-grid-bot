import OpenAI from "openai";
import { CHAT_LLM_MODEL, CHAT_LLM_TIMEOUT_MS, OPENAI_API_KEY } from "../config.js";
import { maxCharsForInput } from "./length.js";
import {
  ASSISTANT_FALLBACK,
  buildChatSystemPrompt,
  looksLikeAssistantReply,
  looksLikeBoringReply,
  looksLikePoetrySpam,
} from "./systemPrompt.js";

let client = null;

function getClient() {
  if (!OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: OPENAI_API_KEY, timeout: CHAT_LLM_TIMEOUT_MS });
  return client;
}

async function callModel(system, userText) {
  const openai = getClient();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: CHAT_LLM_MODEL,
    temperature: 0.88,
    max_tokens: 65,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText.slice(0, 500) },
    ],
  });

  return completion.choices?.[0]?.message?.content?.trim() || null;
}

/**
 * @param {string} userText
 * @param {{ username?: string, displayName?: string, isCear?: boolean }} [userContext]
 * @returns {Promise<string|null>}
 */
function looksTooShort(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= 2 || text.trim().length < 25;
}

export async function generateChatReply(userText, userContext, { isGreeting = false } = {}) {
  const system = buildChatSystemPrompt(userContext, userText);
  const cap = maxCharsForInput(userText, { isGreeting });

  let text = await callModel(system, userText);

  if (
    text &&
    (looksLikeAssistantReply(text) ||
      looksLikeBoringReply(text) ||
      looksLikePoetrySpam(text) ||
      (isGreeting && looksTooShort(text)) ||
      text.length > cap + 15)
  ) {
    const hint = isGreeting
      ? "Too generic, too short, or too poetic. One line with robot personality — dry, introspective, a little smile. Not NPC small talk."
      : looksLikePoetrySpam(text)
        ? "Too poetic. Dial it back — one plain-ish thought with a little robot flavor. Short."
        : "Too generic or boring. Add dry humor or quiet introspection. Still short. Not a poem.";
    text = await callModel(`${system}\n\n${hint}`, userText);
  }

  if (text && (looksLikeAssistantReply(text) || looksLikeBoringReply(text))) {
    text = await callModel(
      `${system}\n\nLast try: sound like a chill robot friend, not a help desk. One small personality beat.`,
      userText
    );
  }

  if (text && looksLikeAssistantReply(text)) text = ASSISTANT_FALLBACK;

  return text;
}
