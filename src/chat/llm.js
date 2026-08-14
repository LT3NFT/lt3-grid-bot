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
export async function generateChatReply(userText, userContext) {
  const system = buildChatSystemPrompt(userContext, userText);

  let text = await callModel(system, userText);

  if (
    text &&
    (looksLikeAssistantReply(text) ||
      looksLikePoetrySpam(text) ||
      text.length > maxCharsForInput(userText) + 10)
  ) {
    text = await callModel(
      `${system}\n\nToo long or too poetic. Shorter. Plain. Based. Like a text message.`,
      userText
    );
  }

  if (text && looksLikeAssistantReply(text)) text = ASSISTANT_FALLBACK;

  return text;
}
