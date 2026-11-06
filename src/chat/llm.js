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
  looksLikeUnpromptedPetTalk,
  looksLikeInventedPersonReply,
  looksLikeReusedLine,
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

  const completion = await createCompletion(openai, CHAT_LLM_MODEL, {
    temperature,
    max_tokens: 80,
    messages,
  });

  return completion.choices?.[0]?.message?.content?.trim() || null;
}

const FALLBACK_MODEL = "gpt-4o-mini";
const unavailableModels = new Set();

/** Use the configured model, dropping to gpt-4o-mini if the account can't use it. */
async function createCompletion(openai, model, params) {
  const useModel = unavailableModels.has(model) ? FALLBACK_MODEL : model;
  try {
    return await openai.chat.completions.create({ model: useModel, ...params });
  } catch (err) {
    const status = err?.status;
    const missingModel = status === 404 || (status === 400 && /model/i.test(String(err?.message)));
    if (useModel === FALLBACK_MODEL || !missingModel) throw err;
    console.warn(`[Chat] model ${useModel} unavailable, falling back to ${FALLBACK_MODEL}`);
    unavailableModels.add(useModel);
    return openai.chat.completions.create({ model: FALLBACK_MODEL, ...params });
  }
}

/** First problem found with a draft reply, as a retry hint. Null when the draft is fine. */
function reviewChatDraft(text, userText, { cap, greetedFirst, welcomeBack, recentReplies }) {
  if (looksLikeAssistantReply(text)) return "That sounded like an assistant. Talk like a friend in Discord.";
  if (looksLikeInventedPersonReply(text, userText)) {
    return "You don't know that person. Say so and ask who they are. Don't invent anything.";
  }
  if (looksLikeCluelessAgreement(text, userText)) {
    return "You can't actually see that. Say so honestly instead of agreeing.";
  }
  if (looksLikeUnpromptedMoss(text, userText) || looksLikeUnpromptedPetTalk(text, userText)) {
    return "They didn't bring up moss, cats, or pets. Leave those out.";
  }
  if (!greetedFirst && looksLikeUnpromptedGreeting(text)) {
    return "They didn't greet you. Skip the hello and respond to what they said.";
  }
  if (looksLikeReusedLine(text, recentReplies)) {
    return "That reused a stock line or something you already said. Say it fresh, specific to this message.";
  }
  if (welcomeBack && looksLikeRepetitiveComeback(text)) {
    return "Skip the comeback story. React to what they actually said.";
  }
  if (looksLikeBoringReply(text) || looksLikePoetrySpam(text) || looksLikeRepetitiveComeback(text)) {
    return "That was filler. Say something specific to their message, dry and plain. If nothing funny fits, just be direct.";
  }
  if (looksLikeDoubleTossBack(text)) return "One question back at most, or none.";
  if (looksCutOff(text) || text.length > cap + 15) {
    return `Shorter. One complete sentence or two, under ${cap} characters.`;
  }
  return null;
}

/**
 * @param {string} userText
 * @param {object} [userContext]
 * @param {{ isGreeting?: boolean }} [options]
 * @returns {Promise<string|null>}
 */
export async function generateChatReply(userText, userContext, { isGreeting = false } = {}) {
  const system = buildChatSystemPrompt(userContext, userText);
  const cap = maxCharsForInput(userText, { isGreeting });
  const replyContext = userContext?.replyContext ?? null;
  const review = {
    cap,
    greetedFirst: userGreetedFirst(userText),
    welcomeBack: isWelcomeBackMessage(userText),
    recentReplies: userContext?.recentReplies ?? [],
  };
  const playful = review.welcomeBack || isLightheartedMessage(userText) || isAffectionateReaction(userText);
  const temperature = playful ? 0.95 : 0.9;

  let text = await callModel(system, userText, { temperature, replyContext });
  for (let attempt = 0; text && attempt < 2; attempt++) {
    if (looksLikeDoubleTossBack(text)) text = fixDoubleTossBack(text);
    const hint = reviewChatDraft(text, userText, review);
    if (!hint) break;
    const retry = await callModel(`${system}\n\nYour draft was: ${text}\n${hint}`, userText, {
      temperature,
      replyContext,
    });
    if (!retry) break;
    text = retry;
  }

  if (text && looksLikeDoubleTossBack(text)) text = fixDoubleTossBack(text);
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

  const completion = await createCompletion(openai, CHAT_VISION_MODEL, {
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
      (reactionMode && looksLikeReusedLine(text, userContext?.recentReplies ?? [])) ||
      text.length > cap + 30)
  ) {
    const hint = reactionMode
      ? "Don't describe the gif. Reply to the feeling behind it and tie it to what's in the thread. One dry, fun line."
      : looksLikeLiteralArtDescription(text)
        ? "Too much catalog description. They want YOUR take. One quick detail nod, then your interpretation. Avoid 'features a' and 'accented by'."
        : looksLikeBoringReply(text, { allowArtVibe: true }) || looksLikeCaptionBotReply(text)
          ? "Too bland. Be clever and specific. No heart-headed essence, great pick, solid vibe, or soft AI filler."
          : looksLikePoetrySpam(text)
            ? "Too poetic. Give your personal read with LT3BOT personality. 2-3 short sentences."
            : looksCutOff(text)
              ? `Reply got cut off. Finish the thought. Under ${cap} characters.`
              : "Too generic. Specific, funny or dry-warm. Not NPC praise.";
    const retry = await createCompletion(openai, CHAT_VISION_MODEL, {
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
