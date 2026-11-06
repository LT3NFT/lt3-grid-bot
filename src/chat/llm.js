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
  isAffectionateReaction,
  isReactionImageReply,
  isRecallQuestion,
  looksLikeAssistantReply,
  looksLikeBoringReply,
  looksLikeCaptionBotReply,
  looksLikeCluelessAgreement,
  looksLikeDoubleTossBack,
  looksLikeLiteralArtDescription,
  looksLikePoetrySpam,
  looksLikeRepetitiveComeback,
  looksLikeUnpromptedGreeting,
  looksLikeUnpromptedMoss,
  looksLikeInventedPersonReply,
  fixDoubleTossBack,
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

async function callModel(system, userText, { temperature = 0.88, replyContext = null } = {}) {
  const openai = getClient();
  if (!openai) return null;

  /** @type {Array<{ role: "system"|"user"|"assistant", content: string }>} */
  const messages = [{ role: "system", content: system }];

  if (replyContext?.thread?.length) {
    for (const entry of replyContext.thread) {
      if (!entry.content) continue;
      messages.push({ role: entry.role, content: entry.content.slice(0, 400) });
    }
  }

  messages.push({ role: "user", content: userText.slice(0, 500) });

  const completion = await openai.chat.completions.create({
    model: CHAT_LLM_MODEL,
    temperature,
    max_tokens: 80,
    messages,
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
  const lighthearted = isLightheartedMessage(userText) || isAffectionateReaction(userText);
  const greetedFirst = userGreetedFirst(userText);
  const personal = /\b(cats?|dogs?|pets?|coding|hanging with)\b/i.test(userText);
  const temp = welcomeBack || lighthearted || personal ? 0.97 : 0.92;
  const replyContext = userContext?.replyContext ?? null;

  let text = await callModel(system, userText, { temperature: temp, replyContext });

  if (text && looksLikeDoubleTossBack(text)) {
    text = fixDoubleTossBack(text);
  }

  if (
    text &&
    (looksLikeAssistantReply(text) ||
      looksLikeBoringReply(text) ||
      looksLikeDoubleTossBack(text) ||
      looksLikeCluelessAgreement(text, userText) ||
      looksLikeRepetitiveComeback(text) ||
      looksLikePoetrySpam(text) ||
      looksLikeUnpromptedMoss(text, userText) ||
      looksLikeInventedPersonReply(text, userText) ||
      (!greetedFirst && looksLikeUnpromptedGreeting(text)) ||
      looksCutOff(text) ||
      (isGreeting && looksTooShort(text)) ||
      text.length > cap + 15)
  ) {
    const hint = looksLikeInventedPersonReply(text, userText)
      ? "You do not know that person. Say you do not know who they mean and ask for context. Do not invent lore."
      : looksLikeUnpromptedMoss(text, userText)
        ? "Do not mention moss unless they brought it up. Reply again without moss."
      : looksLikeCluelessAgreement(text, userText)
      ? "You don't have memory and can't know that. Be honest — say you don't remember or only see this message. No fake yeah."
      : looksCutOff(text)
      ? `Reply got cut off. One or two COMPLETE sentences under ${cap} characters. End on a period.`
      : !greetedFirst && looksLikeUnpromptedGreeting(text)
      ? "You opened with a greeting but they didn't say hello. Drop the hey/hi/hello and respond to what they said."
      : welcomeBack
      ? "Too repetitive or generic. They already know you're back. React to what THEY said — dry joke, playful, warm weirdness. No 'feels good to be back' or 'was dark' lines."
      : looksLikeDoubleTossBack(text)
        ? "You stacked two toss-backs (like Wbu? You?). Pick ONE question max, or none. Statement alone is fine."
      : looksLikeBoringReply(text)
        ? "Too bland. Add dry humor. Deadpan robot joke. Never say vibe/vibes. No LT3 universe, great pick, or polite filler. If they mentioned cats/pets/coding, lead with a no-body joke."
      : isGreeting
        ? "Too bland or too sales-default. One short dry line. Mix it up: X posts, grids, gifs, Discord chat, trait pulls, idle, or sales — not always sales. Optional single toss-back. Never say vibe/vibes or LT3 universe."
        : looksLikePoetrySpam(text)
          ? "Too poetic. Dial it back — one dry thought with robot flavor. Short."
          : looksLikeRepetitiveComeback(text)
            ? "Comeback cliché. Skip the 'good to be back' script. Say something fresh and specific to their message."
            : "Too bland. Add dry humor or a deadpan riff. Still short. Not a poem.";
    text = await callModel(`${system}\n\n${hint}`, userText, { temperature: temp, replyContext });
  }

  if (text && looksLikeDoubleTossBack(text)) {
    text = fixDoubleTossBack(text);
  }

  if (
    text &&
    (looksLikeAssistantReply(text) ||
      looksLikeBoringReply(text) ||
      looksLikeCluelessAgreement(text, userText) ||
      looksLikeInventedPersonReply(text, userText) ||
      (welcomeBack && looksLikeRepetitiveComeback(text)) ||
      (!greetedFirst && looksLikeUnpromptedGreeting(text)))
  ) {
    text = await callModel(
      `${system}\n\nLast try: dry humor, specific, not polite filler. Match their energy without repeating your backstory.`,
      userText,
      { temperature: Math.min(temp + 0.03, 1), replyContext }
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

  const reactionMode = isReactionImageReply(userText, userContext);
  const system = buildVisionAnalysisPrompt(userContext, userText, metadata, { reactionMode });
  const cap = maxCharsForInput(userText, {
    isImageAnalysis: true,
    isGreeting: false,
  });
  const userAskedQuestion = userText.includes("?");
  const replyContext = userContext?.replyContext ?? null;

  const textPart = reactionMode
    ? userText.trim() || "(sent a reaction image/gif with no text — riff on it using the thread)"
    : userText.trim() || "What do you think of this LT3?";

  /** @type {Array<{ role: "system"|"user"|"assistant", content: string | Array<{ type: string, text?: string, image_url?: { url: string, detail: string } }> }>} */
  const messages = [{ role: "system", content: system }];

  if (replyContext?.thread?.length) {
    for (const entry of replyContext.thread) {
      if (!entry.content) continue;
      messages.push({ role: entry.role, content: entry.content.slice(0, 400) });
    }
  }

  /** @type {Array<{ type: string, text?: string, image_url?: { url: string, detail: string } }>} */
  const content = [{ type: "text", text: textPart.slice(0, 800) }];
  for (const url of imageUrls.slice(0, 1)) {
    content.push({ type: "image_url", image_url: { url, detail: reactionMode ? "low" : "high" } });
  }
  messages.push({ role: "user", content });

  const completion = await openai.chat.completions.create({
    model: CHAT_VISION_MODEL,
    temperature: reactionMode ? 0.95 : 0.9,
    max_tokens: reactionMode ? Math.min(CHAT_VISION_MAX_TOKENS, 90) : CHAT_VISION_MAX_TOKENS,
    messages,
  });

  let text = completion.choices?.[0]?.message?.content?.trim() || null;

  if (
    text &&
    (looksLikeAssistantReply(text) ||
      looksLikeBoringReply(text, { allowArtVibe: !reactionMode }) ||
      looksLikeCaptionBotReply(text) ||
      looksLikePoetrySpam(text) ||
      (!reactionMode && looksLikeLiteralArtDescription(text)) ||
      looksCutOff(text) ||
      text.length > cap + 30)
  ) {
    const hint = reactionMode
      ? "Too caption-bot / ChatGPT. Do not narrate the gif. Tie it to the LT3 or vibe in the thread with one clever dry line. Fun, short."
      : looksLikeLiteralArtDescription(text)
        ? "Too much catalog description. They want YOUR take. One quick detail nod, then your interpretation. Avoid 'features a' and 'accented by'."
        : looksLikeBoringReply(text, { allowArtVibe: true }) || looksLikeCaptionBotReply(text)
          ? "Too bland. Be clever and specific. No heart-headed essence, great pick, solid vibe, or soft AI filler."
          : looksLikePoetrySpam(text)
            ? "Too poetic. Give your personal read with LT3BOT personality. 2-3 short sentences."
            : looksCutOff(text)
              ? `Reply got cut off. Finish the thought. Under ${cap} characters.`
              : "Too generic. Specific, funny or dry-warm. Not NPC praise.";
    const retry = await openai.chat.completions.create({
      model: CHAT_VISION_MODEL,
      temperature: 0.92,
      max_tokens: reactionMode ? Math.min(CHAT_VISION_MAX_TOKENS, 90) : CHAT_VISION_MAX_TOKENS,
      messages: [
        { role: "system", content: `${system}\n\n${hint}` },
        ...messages.slice(1),
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
