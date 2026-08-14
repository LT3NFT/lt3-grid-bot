import { OPENAI_API_KEY } from "../config.js";
import { fetchLt3StatsReply, isCollectionStatsQuestion } from "./collectionStats.js";
import { maxCharsForInput } from "./length.js";
import { generateChatReply } from "./llm.js";
import { sanitizeChatReply } from "./sanitize.js";
import { stripTrailingQuestion, stripLeadingGreeting, userGreetedFirst, looksLikeUnpromptedGreeting } from "./systemPrompt.js";
import { SCRIPTED, matchScriptedTrigger, pickGreetingFallback } from "./triggers.js";

function appendNfa(text) {
  const lower = text.toLowerCase();
  if (lower.includes("nfa")) return text;
  const trimmed = text.replace(/\.$/, "");
  return `${trimmed}. NFA.`;
}

/** @returns {Promise<string>} */
export async function buildChatReply(cleanText, userContext) {
  const trigger = matchScriptedTrigger(cleanText);
  const isGreeting = trigger?.kind === "greeting";
  const maxChars = maxCharsForInput(cleanText, { isGreeting });

  if (trigger?.kind === "empty") return SCRIPTED.empty;
  if (trigger?.kind === "egg") return sanitizeChatReply("🥚", { allowEgg: true });
  if (trigger?.kind === "utility") return SCRIPTED.utility;
  if (trigger?.reply) return sanitizeChatReply(trigger.reply);
  if (trigger?.kind === "stats" || isCollectionStatsQuestion(cleanText)) {
    const stats = await fetchLt3StatsReply(cleanText);
    return sanitizeChatReply(stats, { maxChars: 140 });
  }

  if (!OPENAI_API_KEY) {
    if (isGreeting) return sanitizeChatReply(pickGreetingFallback(cleanText.toLowerCase()));
    return SCRIPTED.noApiKey;
  }

  let llmText = null;
  try {
    llmText = await generateChatReply(cleanText, userContext, { isGreeting });
  } catch (err) {
    console.error("[Chat] LLM error", err);
    if (isGreeting) return sanitizeChatReply(pickGreetingFallback(cleanText.toLowerCase()));
    if (trigger?.kind === "trading") return sanitizeChatReply(SCRIPTED.tradingFallback);
    return sanitizeChatReply("Static in the line. Try again.");
  }

  if (!llmText) {
    if (isGreeting) return sanitizeChatReply(pickGreetingFallback(cleanText.toLowerCase()));
    if (trigger?.kind === "trading") return sanitizeChatReply(SCRIPTED.tradingFallback);
    return sanitizeChatReply("Didn't catch that. One more time.");
  }

  let reply = sanitizeChatReply(llmText, { maxChars });
  if (!userGreetedFirst(cleanText) && looksLikeUnpromptedGreeting(reply)) {
    reply = stripLeadingGreeting(reply);
  }
  const skipStripQuestion = userContext?.barryLookingUpJoke;
  reply = stripTrailingQuestion(reply, cleanText.includes("?") || skipStripQuestion);
  if (trigger?.kind === "trading") reply = sanitizeChatReply(appendNfa(reply));
  return reply;
}
