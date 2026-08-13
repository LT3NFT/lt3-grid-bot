import { OPENAI_API_KEY } from "../config.js";
import { fetchLt3FloorReply } from "./floor.js";
import { generateChatReply } from "./llm.js";
import { sanitizeChatReply } from "./sanitize.js";
import { SCRIPTED, matchScriptedTrigger } from "./triggers.js";

function appendNfa(text) {
  const lower = text.toLowerCase();
  if (lower.includes("nfa")) return text;
  const trimmed = text.replace(/\.$/, "");
  return `${trimmed}. NFA.`;
}

/** @returns {Promise<string>} */
export async function buildChatReply(cleanText) {
  const trigger = matchScriptedTrigger(cleanText);

  if (trigger?.kind === "empty") return SCRIPTED.empty;
  if (trigger?.kind === "egg") return sanitizeChatReply("🥚", { allowEgg: true });
  if (trigger?.kind === "utility") return SCRIPTED.utility;
  if (trigger?.reply) return sanitizeChatReply(trigger.reply);
  if (trigger?.kind === "floor") {
    const floor = await fetchLt3FloorReply();
    return sanitizeChatReply(floor, { allowEgg: false });
  }

  if (!OPENAI_API_KEY) return SCRIPTED.noApiKey;

  let llmText = null;
  try {
    llmText = await generateChatReply(cleanText);
  } catch (err) {
    console.error("[Chat] LLM error", err);
    if (trigger?.kind === "trading") return sanitizeChatReply(SCRIPTED.tradingFallback);
    return sanitizeChatReply("Static in the line. Try again.");
  }

  if (!llmText) {
    if (trigger?.kind === "trading") return sanitizeChatReply(SCRIPTED.tradingFallback);
    return sanitizeChatReply("Didn't catch that. One more time.");
  }

  let reply = sanitizeChatReply(llmText);
  if (trigger?.kind === "trading") reply = sanitizeChatReply(appendNfa(reply));
  return reply;
}
