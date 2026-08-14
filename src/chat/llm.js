import OpenAI from "openai";
import { CHAT_LLM_MODEL, CHAT_LLM_TIMEOUT_MS, OPENAI_API_KEY } from "../config.js";
import { maxCharsForInput } from "./length.js";
import {
  ASSISTANT_FALLBACK,
  buildChatSystemPrompt,
  isWelcomeBackMessage,
  isLightheartedMessage,
  looksLikeAssistantReply,
  looksLikeBoringReply,
  looksLikePoetrySpam,
  looksLikeRepetitiveComeback,
  looksLikeUnpromptedGreeting,
  userGreetedFirst,
} from "./systemPrompt.js";

let client = null;

function getClient() {
  if (!OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: OPENAI_API_KEY, timeout: CHAT_LLM_TIMEOUT_MS });
  return client;
}

async function callModel(system, userText, { temperature = 0.88 } = {}) {
  const openai = getClient();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: CHAT_LLM_MODEL,
    temperature,
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
  const welcomeBack = isWelcomeBackMessage(userText);
  const lighthearted = isLightheartedMessage(userText);
  const greetedFirst = userGreetedFirst(userText);
  const temp = welcomeBack || lighthearted ? 0.95 : 0.88;

  let text = await callModel(system, userText, { temperature: temp });

  if (
    text &&
    (looksLikeAssistantReply(text) ||
      looksLikeBoringReply(text) ||
      looksLikeRepetitiveComeback(text) ||
      looksLikePoetrySpam(text) ||
      (!greetedFirst && looksLikeUnpromptedGreeting(text)) ||
      (isGreeting && looksTooShort(text)) ||
      text.length > cap + 15)
  ) {
    const hint = !greetedFirst && looksLikeUnpromptedGreeting(text)
      ? "You opened with a greeting but they didn't say hello. Drop the hey/hi/hello and respond to what they said."
      : welcomeBack
      ? "Too repetitive or generic. They already know you're back. React to what THEY said — dry joke, playful, warm weirdness. No 'feels good to be back' or 'was dark' lines."
      : isGreeting
        ? "Too generic, too short, or too poetic. One line with robot personality — dry, introspective, a little smile. Not NPC small talk."
        : looksLikePoetrySpam(text)
          ? "Too poetic. Dial it back — one plain-ish thought with a little robot flavor. Short."
          : looksLikeRepetitiveComeback(text)
            ? "Comeback cliché. Skip the 'good to be back' script. Say something fresh and specific to their message."
            : "Too generic or boring. Add dry humor or quiet introspection. Still short. Not a poem.";
    text = await callModel(`${system}\n\n${hint}`, userText, { temperature: temp });
  }

  if (
    text &&
    (looksLikeAssistantReply(text) ||
      looksLikeBoringReply(text) ||
      (welcomeBack && looksLikeRepetitiveComeback(text)) ||
      (!greetedFirst && looksLikeUnpromptedGreeting(text)))
  ) {
    text = await callModel(
      `${system}\n\nLast try: fun, specific, not a template. Match their energy without repeating your backstory.`,
      userText,
      { temperature: temp }
    );
  }

  if (text && looksLikeAssistantReply(text)) text = ASSISTANT_FALLBACK;

  return text;
}
