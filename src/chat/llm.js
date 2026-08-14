import OpenAI from "openai";
import { CHAT_LLM_MODEL, CHAT_LLM_TIMEOUT_MS, OPENAI_API_KEY } from "../config.js";
import { maxCharsForInput } from "./length.js";
import {
  ASSISTANT_FALLBACK,
  buildChatSystemPrompt,
  looksLikeAssistantReply,
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
    temperature: 0.82,
    max_tokens: 55,
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
      looksLikePoetrySpam(text) ||
      (isGreeting && looksTooShort(text)) ||
      text.length > cap + 10)
  ) {
    const hint = isGreeting
      ? "Too short, too long, or too poetic. One friendly casual sentence. Not one word. Not a poem."
      : "Too long or too poetic. Shorter. Plain. Based. Like a text message.";
    text = await callModel(`${system}\n\n${hint}`, userText);
  }

  if (text && looksLikeAssistantReply(text)) text = ASSISTANT_FALLBACK;

  return text;
}
