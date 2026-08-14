import { CHAT_MAX_CHARS } from "../config.js";

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu;

function capitalizeSentences(text) {
  if (!text) return text;
  const capped = text.charAt(0).toUpperCase() + text.slice(1);
  return capped.replace(/([.!?]\s+)([a-z])/g, (_, punct, letter) => punct + letter.toUpperCase());
}

function findLastSentenceEndInWindow(text) {
  let bestEnd = -1;
  for (let i = 0; i < text.length; i++) {
    if (".!?".includes(text[i])) {
      const after = text.slice(i + 1);
      if (after.length === 0 || /^\s/.test(after)) {
        bestEnd = i;
      }
    }
  }
  return bestEnd;
}

/** Trim overlong text at a sentence boundary, never mid-clause. */
export function trimToCompleteThought(text, maxChars) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const window = trimmed.slice(0, maxChars);
  const sentenceEnd = findLastSentenceEndInWindow(window);
  if (sentenceEnd >= 12) {
    return window.slice(0, sentenceEnd + 1).trim();
  }

  const lastSpace = window.lastIndexOf(" ");
  if (lastSpace > 12) {
    return `${window.slice(0, lastSpace).trim().replace(/[,;:]$/, "")}.`;
  }

  if (window.length > 1) {
    return `${window.slice(0, Math.max(1, maxChars - 1)).trim()}.`;
  }

  return `${window.trim()}.`;
}

export function looksCutOff(text) {
  const t = text.trim();
  if (!t) return true;
  return !/[.!?]["']?$/.test(t);
}

function fixUnbalancedQuotes(text) {
  let out = text.replace(/"/g, "");

  out = out.replace(/(\s)'([^']+)'/g, "$1$2");
  out = out.replace(/^'([^']+)'/g, "$1");

  const singles = [...out.matchAll(/'/g)].map((m) => m.index);
  if (singles.length % 2 === 1) {
    for (let i = singles.length - 1; i >= 0; i--) {
      const idx = singles[i];
      const prev = out[idx - 1];
      const next = out[idx + 1];
      const isApostrophe = prev && next && /[a-zA-Z]/.test(prev) && /[a-zA-Z]/.test(next);
      if (!isApostrophe) {
        out = out.slice(0, idx) + out.slice(idx + 1);
        break;
      }
    }
  }

  return out.replace(/\s+/g, " ").trim();
}

/** Enforce LT3BOT chat output rules. */
export function sanitizeChatReply(raw, { allowEgg = false, maxChars = CHAT_MAX_CHARS } = {}) {
  if (!raw || typeof raw !== "string") return "Say that again. I lost the signal.";

  let text = raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(/!/g, ".");
  text = text.replace(/\s*[—–]\s*/g, ". ");
  text = text.replace(/\.\s+\./g, ".");
  if (!allowEgg) text = text.replace(EMOJI_RE, "").trim();

  if (text.length > maxChars) {
    text = trimToCompleteThought(text, maxChars);
  } else if (looksCutOff(text) && text.length > 15) {
    const lastSpace = text.lastIndexOf(" ");
    if (lastSpace > 12) {
      text = `${text.slice(0, lastSpace).trim().replace(/[,;:]$/, "")}.`;
    } else {
      text = `${text.trim().replace(/[,;:]$/, "")}.`;
    }
  }

  if (text.length > 0) {
    text = fixUnbalancedQuotes(text);
    text = capitalizeSentences(text);
  }

  return text || "Say that again. I lost the signal.";
}
