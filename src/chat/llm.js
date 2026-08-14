import OpenAI from "openai";
import { CHAT_LLM_MODEL, CHAT_LLM_TIMEOUT_MS, OPENAI_API_KEY } from "../config.js";
import {
  ASSISTANT_FALLBACK,
  buildChatSystemPrompt,
  looksLikeAssistantReply,
} from "./systemPrompt.js";

let client = null;

function getClient() {
  if (!OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: OPENAI_API_KEY, timeout: CHAT_LLM_TIMEOUT_MS });
  return client;
}

/**
 * @param {string} userText
 * @param {{ username?: string, displayName?: string, isCear?: boolean }} [userContext]
 * @returns {Promise<string|null>}
 */
export async function generateChatReply(userText, userContext) {
  const openai = getClient();
  if (!openai) return null;

  const system = buildChatSystemPrompt(userContext);

  const completion = await openai.chat.completions.create({
    model: CHAT_LLM_MODEL,
    temperature: 0.92,
    max_tokens: 120,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText.slice(0, 500) },
    ],
  });

  let text = completion.choices?.[0]?.message?.content?.trim() || null;
  if (text && looksLikeAssistantReply(text)) {
    const retry = await openai.chat.completions.create({
      model: CHAT_LLM_MODEL,
      temperature: 0.95,
      max_tokens: 120,
      messages: [
        { role: "system", content: `${system}\n\nYour last reply sounded like a help desk. Try again — weird, calm, LT3BOT.` },
        { role: "user", content: userText.slice(0, 500) },
      ],
    });
    text = retry.choices?.[0]?.message?.content?.trim() || ASSISTANT_FALLBACK;
    if (looksLikeAssistantReply(text)) text = ASSISTANT_FALLBACK;
  }

  return text;
}
