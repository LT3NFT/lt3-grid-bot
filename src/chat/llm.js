import OpenAI from "openai";
import {
  CHAT_LLM_MODEL,
  CHAT_LLM_TIMEOUT_MS,
  CHAT_VISION_MAX_TOKENS,
  CHAT_VISION_MODEL,
  CHAT_VISION_TIMEOUT_MS,
  OPENAI_API_KEY,
} from "../config.js";
import { maxCharsForInput } from "./length.js";
import {
  ASSISTANT_FALLBACK,
  buildChatSystemPrompt,
  buildVisionAnalysisPrompt,
  isWelcomeBackMessage,
  isLightheartedMessage,
  isRecallQuestion,
  looksLikeAssistantReply,
  looksLikeBoringReply,
  looksLikeCluelessAgreement,
  looksLikeLiteralArtDescription,
  looksLikePoetrySpam,
  looksLikeRepetitiveComeback,
  looksLikeUnpromptedGreeting,
  userGreetedFirst,
} from "./systemPrompt.js";
import { looksCutOff } from "./sanitize.js";

let client = null;
let visionClient = null;

function getClient() {
  if (!OPENAI_API_KEY) return null;
  if (!client) client = new OpenAI({ apiKey: OPENAI_API_KEY, timeout: CHAT_LLM_TIMEOUT_MS });
  return client;
}

function getVisionClient() {
  if (!OPENAI_API_KEY) return null;
  if (!visionClient) {
    visionClient = new OpenAI({ apiKey: OPENAI_API_KEY, timeout: CHAT_VISION_TIMEOUT_MS });
  }
  return visionClient;
}

async function callModel(system, userText, { temperature = 0.88 } = {}) {
  const openai = getClient();
  if (!openai) return null;

  const completion = await openai.chat.completions.create({
    model: CHAT_LLM_MODEL,
    temperature,
    max_tokens: 80,
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
      looksLikeCluelessAgreement(text, userText) ||
      looksLikeRepetitiveComeback(text) ||
      looksLikePoetrySpam(text) ||
      (!greetedFirst && looksLikeUnpromptedGreeting(text)) ||
      looksCutOff(text) ||
      (isGreeting && looksTooShort(text)) ||
      text.length > cap + 15)
  ) {
    const hint = looksLikeCluelessAgreement(text, userText)
      ? "You don't have memory and can't know that. Be honest — say you don't remember or only see this message. No fake yeah."
      : looksCutOff(text)
      ? `Reply got cut off. One or two COMPLETE sentences under ${cap} characters. End on a period.`
      : !greetedFirst && looksLikeUnpromptedGreeting(text)
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
      looksLikeCluelessAgreement(text, userText) ||
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

/**
 * @param {string} userText
 * @param {object} [userContext]
 * @param {{ imageUrls?: string[], metadata?: object|null }} [options]
 * @returns {Promise<string|null>}
 */
export async function generateVisionReply(userText, userContext, { imageUrls = [], metadata = null } = {}) {
  const openai = getVisionClient();
  if (!openai || !imageUrls.length) return null;

  const system = buildVisionAnalysisPrompt(userContext, userText, metadata);
  const cap = maxCharsForInput(userText, { isImageAnalysis: true });
  const userAskedQuestion = userText.includes("?");

  const textPart = userText.trim() || "Analyze this LT3.";
  /** @type {Array<{ type: string, text?: string, image_url?: { url: string, detail: string } }>} */
  const content = [{ type: "text", text: textPart.slice(0, 800) }];
  for (const url of imageUrls.slice(0, 1)) {
    content.push({ type: "image_url", image_url: { url, detail: "high" } });
  }

  const completion = await openai.chat.completions.create({
    model: CHAT_VISION_MODEL,
    temperature: 0.9,
    max_tokens: CHAT_VISION_MAX_TOKENS,
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
  });

  let text = completion.choices?.[0]?.message?.content?.trim() || null;

  if (
    text &&
    (looksLikeAssistantReply(text) ||
      looksLikeBoringReply(text) ||
      looksLikePoetrySpam(text) ||
      looksLikeLiteralArtDescription(text) ||
      looksCutOff(text) ||
      text.length > cap + 30)
  ) {
    const hint = looksLikeLiteralArtDescription(text)
      ? "Too much catalog description. They want YOUR take. How does it make you feel? What meaning do you read into it? One quick detail nod, then your interpretation. Avoid 'features a' and 'accented by'."
      : looksLikePoetrySpam(text)
        ? "Too poetic. Give your personal read on the piece with LT3BOT personality. How does it feel? 2-3 short sentences."
        : looksCutOff(text)
          ? `Reply got cut off. Finish the thought. Under ${cap} characters.`
          : "Too generic. Share how THIS lt3 makes you feel or what it means to you. Specific, not NPC praise.";
    const retry = await openai.chat.completions.create({
      model: CHAT_VISION_MODEL,
      temperature: 0.88,
      max_tokens: CHAT_VISION_MAX_TOKENS,
      messages: [
        { role: "system", content: `${system}\n\n${hint}` },
        { role: "user", content },
      ],
    });
    text = retry.choices?.[0]?.message?.content?.trim() || text;
  }

  if (text && looksLikeAssistantReply(text)) text = ASSISTANT_FALLBACK;
  if (text && !userAskedQuestion && text.trim().endsWith("?")) {
    text = text.replace(/\s*[^.!?]*\?\s*$/, ".").trim();
  }

  return text;
}
