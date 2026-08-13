import OpenAI from "openai";
import { CHAT_LLM_MODEL, CHAT_LLM_TIMEOUT_MS, OPENAI_API_KEY } from "../config.js";
import { LT3BOT_SYSTEM_PROMPT } from "./systemPrompt.js";

let client = null;

function getClient() {
  if (!OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: OPENAI_API_KEY, timeout: CHAT_LLM_TIMEOUT_MS });
  return client;
}

/** @returns {Promise<string|null>} */
export async function generateChatReply(userText) {
  const openai = getClient();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: CHAT_LLM_MODEL,
    temperature: 0.85,
    max_tokens: 80,
    messages: [
      { role: "system", content: LT3BOT_SYSTEM_PROMPT },
      { role: "user", content: userText.slice(0, 500) },
    ],
  });

  const text = completion.choices?.[0]?.message?.content?.trim();
  return text || null;
}
