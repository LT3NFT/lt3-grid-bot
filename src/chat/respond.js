import { OPENAI_API_KEY } from "../config.js";
import { fetchLt3FloorReply } from "./floor.js";
import { maxCharsForInput } from "./length.js";
import { generateChatReply } from "./llm.js";
import { sanitizeChatReply } from "./sanitize.js";
import { stripTrailingQuestion } from "./systemPrompt.js";
import { SCRIPTED, matchScriptedTrigger, pickGreetingLine } from "./triggers.js";

function appendNfa(text) {
  const lower = text.toLowerCase();
  if (lower.includes("nfa")) return text;
  const trimmed = text.replace(/\.$/, "");
  return `${trimmed}. NFA.`;
}

/** @returns {Promise<string>} */
export async function buildChatReply(cleanText, userContext) {
  const trigger = matchScriptedTrigger(cleanText);
  const maxChars = maxCharsForInput(cleanText);

  if (trigger?.kind === "empty") return SCRIPTED.empty;
  if (trigger?.kind === "egg") return sanitizeChatReply("🥚", { allowEgg: true });
  if (trigger?.kind === "greeting") return pickGreetingLine(cleanText.toLowerCase());
  if (trigger?.kind === "utility") return SCRIPTED.utility;
  if (trigger?.reply) return sanitizeChatReply(trigger.reply);
  if (trigger?.kind === "floor") {
    const floor = await fetchLt3FloorReply();
    return sanitizeChatReply(floor, { allowEgg: false });
  }

  if (!OPENAI_API_KEY) return SCRIPTED.noApiKey;

  let llmText = null;
  try {
    llmText = await generateChatReply(cleanText, userContext);
  } catch (err) {
    console.error("[Chat] LLM error", err);
    if (trigger?.kind === "trading") return sanitizeChatReply(SCRIPTED.tradingFallback);
    return sanitizeChatReply("Static in the line. Try again.");
  }

  if (!llmText) {
    if (trigger?.kind === "trading") return sanitizeChatReply(SCRIPTED.tradingFallback);
    return sanitizeChatReply("Didn't catch that. One more time.");
  }

  let reply = sanitizeChatReply(llmText, { maxChars });
  reply = stripTrailingQuestion(reply, cleanText.includes("?"));
  if (trigger?.kind === "trading") reply = sanitizeChatReply(appendNfa(reply));
  return reply;
}
