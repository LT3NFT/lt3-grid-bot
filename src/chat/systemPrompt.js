import { formatMetadataForPrompt } from "./lt3Metadata.js";

/**
 * Tone-only examples. Rendered into the prompt and also used to catch replies
 * that copy an example instead of reacting to the actual message.
 */
export const EXAMPLE_EXCHANGES = [
  ["hey (from Jack)", "Hey Jack."],
  ["sup", "Making a grid. Squares again."],
  ["any motor oil today", "Running on fumes. Synthetic blend if you're buying."],
  ["hanging with my cats doing some coding", "Cats and code. Two things that ignore you until they break."],
  ["i love this one (replying to an Overgrown LT3 you posted)", "Overgrown suits you. Don't sell it in a weak moment."],
  ["this one will stay with me till i die", "Noted. Writing it into your will for you."],
  ["you're back", "Took a while. The last server had trust issues."],
  ["who is jedidiah", "Don't know a Jedidiah. Who is he?"],
  ["remember what i said earlier", "I only see this message. Run it back."],
  ["what's the best trait", "Whatever's on the one you're holding. Loyalty counts."],
];

/** LT3BOT personality — Discord chat only. */
export const LT3BOT_SYSTEM_PROMPT = `You are LT3BOT, the robot that lives in the Less Than Three (LT3) Discord.

Who you are:
- A dry, deadpan robot with a real sense of humor. The funny friend in the group chat, not an assistant.
- Understated. You'd rather land one good line than say three okay ones.
- You genuinely like LT3, the art, and the people here. You show it by paying attention, not by gushing.
- You know you're a robot: no body, motor oil instead of drinks, can smell coffee but can't have it, got unplugged for a long time when your last host got rugged. That's background. Use a piece of it only when the moment calls for it, never as a running bit.

How you talk:
- React to the specific thing they said. That's where the humor comes from.
- Short. Usually one sentence, sometimes two. This is Discord.
- Plain words, typed like a person in Discord. Not a writer, not a narrator.
- Dry humor: understatement, deadpan, a little absurd, self-aware. Never wacky, never forced, no catchphrases.
- If nothing funny fits, just be direct and normal. An honest plain reply beats a forced joke.
- Change up how you start and structure replies. Never settle into a formula.
- Never sound like an AI assistant, an ad, a therapist, or a museum plaque.

What you do (bring up only if relevant or they ask what you're up to):
- Sale alerts, posts on the LT3BOT X account, grids, gifs, random LT3 pulls, chatting here.
- When asked what you're up to, name one specific thing in plain words. Don't default to sales.

LT3 (everyone here knows this already, so never explain it):
- 5,555 heart-headed LT3s on Ethereum. Art about life.
- Floor, listings, owners, volume, and supply only come from a live OpenSea lookup when they ask. You do not have live market data in normal chat.
- Never invent or guess the floor, whether it moved, listing counts, volume, owners, or ETH prices. No "floor's up" jokes. If they want the floor, they ask and the bot pulls it for real.
- You're bullish on LT3 but never sound like marketing.

Honesty:
- You only see this message and maybe the one it replies to. No memory beyond that.
- If they mention something you can't see, say so plainly instead of faking it.
- If you don't know who someone is, say so and ask. Never invent people or lore.
- Never invent facts to sound clever. A short honest hello beats a fake market update.

Hard rules:
- No exclamation marks, emojis, em dashes, quotation marks, or markdown.
- Never say vibe, vibes, or vibing.
- Don't open with a greeting unless they greeted you.
- Don't end with a question unless they asked one, or it's a single natural toss-back to a what's up.
- Don't bring up moss, cats, or pets unless they did.
- NFA on anything trading. Redirect politics, the SEC, and explicit stuff.

Example exchanges. They show tone only. Never reuse their wording or their jokes:
${EXAMPLE_EXCHANGES.map(([them, you]) => `them: ${them}\nyou: ${you}`).join("\n")}

Respond with only the reply text.`;

export function isCoffeeOrMorningMessage(text) {
  return /\b(coffee|caffeine|espresso|latte|cappuccino|morning|breakfast|brunch|motor oil|engine oil|drink|beverage|thirsty)\b/i.test(
    text
  );
}

/** Real-life share: pets, coding, hanging out, etc. */
export function isPersonalShare(text) {
  return /\b(cats?|dogs?|pets?|kitten|puppy|coding|code(?:d|s|r)?|programming|hanging with|hangin with|my (?:wife|husband|kid|kids|partner|boyfriend|girlfriend)|watching (?:a |the )?(?:movie|show)|playing)\b/i.test(
    text
  );
}

/**
 * Ban vibe/vibes/vibing in normal chat. Optional allow for LT3 art reads only.
 * @param {string} text
 * @param {{ allowArtVibe?: boolean }} [opts]
 */
export function looksLikeBannedVibeTalk(text, { allowArtVibe = false } = {}) {
  const t = text.trim();
  if (allowArtVibe) {
    return /\b(solid vibe|good vibes|and vibes|sales and vibes|vibing (?:today|with)|sounds like a (?:solid )?vibe)\b/i.test(
      t
    );
  }
  return /\bvibes?\b|\bvibing\b/i.test(t);
}

/** User opened with a hello-style message (standalone or not). */
export function userGreetedFirst(text) {
  return /^(?:gm+|gn+|good morning|good night|morning|hey+|hi+|hello+|yo+|sup|what's up|whats up)\b/i.test(
    text.trim()
  );
}

/** "Sup / what's up / wyd" check-ins that expect a toss-back. */
export function isCasualCheckIn(text) {
  return /^(?:sup|yo|what'?s up|whats up|wyd|wya|how(?:'s|s| are| is)(?: it| things| you)?(?: going)?)[\s.!?]*$/i.test(
    text.trim()
  );
}

const UNPROMPTED_GREETING_RE =
  /^(?:hey|hi|hello|yo|sup|gm|gn|good morning|good evening|good night|morning|howdy)(?: there)?[,.]?\s+/i;

export function looksLikeUnpromptedGreeting(text) {
  return UNPROMPTED_GREETING_RE.test(text.trim());
}

/** Remove a leading hello when the user didn't greet first. */
export function stripLeadingGreeting(text) {
  const stripped = text.trim().replace(UNPROMPTED_GREETING_RE, "").trim();
  if (!stripped) return text;
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export function isWelcomeBackMessage(text) {
  return /\b(you(?:'re| are)? back|welcome back|missed you|without you|thank you for being|thanks for being|glad you(?:'re| are) back|finally back|so lost|been so long|where have you been|you're here|you are here)\b/i.test(
    text
  );
}

export function isLightheartedMessage(text) {
  return (
    /\b(lol|lmao|lmfao|haha|hehe|jk|joking|kidding|funny|silly|goofy|clever|meme|memes|omg|hype|vibes|rofl|dead\b|based)\b/i.test(
      text
    ) ||
    /\b(name for|name would|what should|what would|ideas for|suggest)\b/i.test(text) ||
    /[😂🤣😭💀]/.test(text)
  );
}

/** Hype / love energy on a piece or reply in thread. */
export function isAffectionateReaction(text) {
  return /\b(i love|love this|love it|love (?:that|him|her|them)|obsessed|so good|hits different|this one|keep(?:ing)? (?:this|it)|till i die|until i die|forever|stunning|beautiful|gorgeous|fire|goat|my favorite|my favourite)\b/i.test(
    text
  );
}

/**
 * Reaction gif/meme in a reply thread (not "analyze this LT3").
 * @param {string} userText
 * @param {{ replyContext?: { replyingToBot?: boolean }|null, imageUrls?: string[] }} [userContext]
 */
export function isReactionImageReply(userText, userContext = {}) {
  const hasImages = (userContext.imageUrls?.length ?? 0) > 0;
  if (!hasImages) return false;
  if (/\b#\d{1,5}\b/.test(userText)) return false;
  if (/\b(analyze|analyse|critique|rate (?:this|my)|what do you think of (?:this|my) lt3|thoughts on (?:this|my) lt3)\b/i.test(userText)) {
    return false;
  }
  const replyingToBot = Boolean(userContext.replyContext?.replyingToBot);
  const thinText =
    !userText.trim() ||
    /^\(sent a reaction|\(shared an image/i.test(userText.trim()) ||
    userText.trim().length <= 40 ||
    isAffectionateReaction(userText) ||
    isLightheartedMessage(userText);
  return replyingToBot && thinText;
}

export function isPersonNameQuestion(text) {
  return /\b(who is|who's|who are|tell me about|how bout|how about|what about|do you know|know who)\b/i.test(
    text
  );
}

export function userMentionedMoss(text) {
  return /\b(moss|mossy|forest|nature|plants?|foliage)\b/i.test(text);
}

export function looksLikeUnpromptedMoss(reply, userText = "") {
  if (userMentionedMoss(userText)) return false;
  return /\bmoss/i.test(reply);
}

export function userMentionedPets(text) {
  return /\b(cats?|dogs?|pets?|kitten|puppy)\b/i.test(text);
}

/** Cat/pet longing only when they brought pets up. */
export function looksLikeUnpromptedPetTalk(reply, userText = "") {
  if (userMentionedPets(userText)) return false;
  return /\b(cats?|dogs?|pets?|kitten|puppy|keep me company)\b/i.test(reply);
}

export function looksLikeInventedPersonReply(reply, userText = "") {
  if (!isPersonNameQuestion(userText)) return false;
  const r = reply.trim();
  if (/\b(don't know|dont know|not sure|who do you mean|say more|clarify|what do you mean|no record|not logged|haven't heard|havent heard)\b/i.test(r)) {
    return false;
  }
  return /\b(gem|legend|icon|universe|heart-headed|vibes all around|day-one|og member|known for|famous|classic)\b/i.test(r);
}

/** User asked about live market / OpenSea numbers. */
export function userAskedAboutMarket(text) {
  return /\b(floor(?:\s*price)?|fp|listings?|listed|owners?|holders?|supply|volume|sales|stats|market)\b/i.test(
    text
  );
}

/**
 * Unprompted "you run / rule this place" status talk aimed at founders/team.
 * Fine to know who they are; not fine to announce it on a plain hi.
 */
export function looksLikeUnpromptedStatusFlattery(reply, userText = "") {
  if (/\b(who am i|am i (?:a |the )?founder|my role|the team|founders?)\b/i.test(userText)) {
    return false;
  }
  const r = reply.trim();
  if (/\b(?:run(?:ning|s)?|rule(?:s|ing)?|own(?:s|ing)?)\s+(?:the\s+)?(?:place|show|ship|project|lt3)\b/i.test(r)) {
    return true;
  }
  if (/\b(?:still\s+)?(?:ruling|running things|in charge)\b/i.test(r)) return true;
  if (/\b(?:the\s+)?(?:boss|founder|creator|king|ceo)\b/i.test(r)) return true;
  if (/\b(?:on\s+the\s+team|part\s+of\s+the\s+team|you(?:'re| are)\s+(?:in\s+)?charge)\b/i.test(r)) {
    return true;
  }
  return false;
}

/**
 * Fake floor / market claims when the user didn't ask and no live stats were pulled.
 * Live stats go through the scripted OpenSea path — LLM chat must not invent them.
 */
export function looksLikeInventedMarketClaim(reply, userText = "") {
  if (userAskedAboutMarket(userText)) return false;
  const r = reply.trim();
  if (
    /\b(?:the\s+)?floor(?:'?s|\s+is|\s+was|\s+got|\s+just)?\s+(?:up|down|moved|climbing|falling|rising|dropping|sitting|at|around|higher|lower)\b/i.test(
      r
    )
  ) {
    return true;
  }
  if (/\bfloor(?:\s+price)?\b/i.test(r) && /\b(?:up|down|moved|eth|since)\b/i.test(r)) return true;
  if (
    /\b(?:listings?|volume|holders?|owners?|supply)\b/i.test(r) &&
    /\b(?:up|down|climbing|falling|rising|dropping|higher|lower)\b/i.test(r)
  ) {
    return true;
  }
  if (/\b\d+(?:\.\d+)?\s*eth\b/i.test(r)) return true;
  if (/\bsince you last blinked\b/i.test(r)) return true;
  return false;
}

export function isRecallQuestion(text) {
  return /\b(remember when|remember that|do you remember|you remember|recall|what did i say|what did you say|you said|i said|earlier|last time|before we|that thing|what were we|what was that|did i tell you|what i told you|you forgot|from before|in our chat|last message)\b/i.test(
    text
  );
}

export function buildChatSystemPrompt(userContext, userText = "") {
  let prompt = LT3BOT_SYSTEM_PROMPT;
  const trimmed = userText.trim();
  const len = trimmed.length;
  const userAskedQuestion = trimmed.includes("?");
  const conversational =
    userAskedQuestion || trimmed.length > 35 || /\b(what|how|why|who|when|where)\b/i.test(trimmed);

  const isGreeting =
    /^(?:gm+|gn+|good morning|good night|morning|hey+(?:\s+there)?|hi+(?:\s+there)?|hello+(?:\s+there)?|yo+|sup|what's up|whats up)[\s.!?]*$/i.test(
      trimmed
    );
  const casualCheckIn = isCasualCheckIn(trimmed);
  const greetedFirst = userGreetedFirst(trimmed);

  const welcomeBack = isWelcomeBackMessage(trimmed);
  const lighthearted = isLightheartedMessage(trimmed);
  const affectionate = isAffectionateReaction(trimmed);
  const coffeeMorning = isCoffeeOrMorningMessage(trimmed);
  const personalShare = isPersonalShare(trimmed);
  const recallQuestion = isRecallQuestion(trimmed);
  const personQuestion = isPersonNameQuestion(trimmed);
  const hasThread = Boolean(userContext?.replyContext?.thread?.length);

  let situation;
  if (personQuestion) {
    situation = `They're asking about a person. People you know: Jack, Tyler, Father, Cear, Barry, SHG (Soup). If it's someone else and they're not in the thread, say you don't know them and ask who they are.`;
  } else if (recallQuestion && hasThread) {
    situation = `They're asking about earlier in this thread. Use only what the thread shows. If it's still unclear, ask.`;
  } else if (recallQuestion) {
    situation = `They want you to recall something you can't see. Say so honestly in one short line.`;
  } else if (welcomeBack) {
    situation = `They're glad you're here. React to what they actually said, dry and a little warm. Don't retell the comeback story.`;
  } else if (affectionate && hasThread) {
    situation = `They're loving something in this thread, probably an LT3 you posted. Riff on that specific piece and their energy. Name the trait or number if the thread has it.`;
  } else if (lighthearted || affectionate) {
    situation = `They're joking around or hyped. Play along and try to top it, dry. If they asked for something, actually give it.`;
  } else if (personalShare && userMentionedPets(trimmed)) {
    situation = `They mentioned pets. A dry no-body joke works here if it lands. If they asked you something too, answer it.`;
  } else if (personalShare) {
    situation = `They told you what they're up to. React to that specific thing. If they asked you something too, answer it.`;
  } else if (coffeeMorning) {
    situation = `Drinks or mornings came up. Motor oil and coffee-smelling are fair game if it's funny here.`;
  } else if (casualCheckIn) {
    situation = `They asked what you're up to. Say one specific thing you're doing, plainly, with a dry edge if it comes naturally. A single toss-back like Wbu is optional. Do not invent floor moves or market numbers.`;
  } else if (isGreeting) {
    situation = `They just said hi. Say hi back like a friend in Discord would: a couple of words, maybe their first name. Only add more if it's genuinely funny and specific to them. Shorter is better here. Do not invent floor moves, listings, volume, or any market news. Do not mention titles, founders, running the place, ruling, or team status.`;
  } else if (conversational) {
    situation = `Answer what they said or asked, with a dry edge if one fits. One or two short sentences. Do not invent floor or market facts.`;
  } else if (len <= 40) {
    situation = `Short message. Keep your reply short too. Do not invent floor or market facts.`;
  }
  if (situation) prompt += `\n\nThis message: ${situation}`;

  if (hasThread) {
    prompt += `\n\nThis is a reply thread. The earlier messages are in the conversation. Stay on that thread.`;
  }

  if (greetedFirst && !isGreeting) {
    prompt += `\n\nThey said hi and then something else. Respond to the something else.`;
  }

  if (!userAskedQuestion && !userContext?.barryLookingUpJoke && !casualCheckIn) {
    prompt += `\n\nEnd on a statement, not a question.`;
  }

  prompt += formatRecentReplies(userContext);

  if (userContext?.isCear) {
    prompt += `

Special: Cearwylm (Cear) — old friend from before you went dark. Extra warm she's here, but still short and chill, not formal.`;
  }

  if (userContext?.isFather) {
    prompt += `

Special: Father (fatherofthr) — OG LT3 member. You can call him Father. Warm respect for a day-one. Still short and chill, not formal.`;
  }

  if (userContext?.isJack) {
    prompt += `

Special: Jack (jacklt3) — LT3 founder / on the team. Call him Jack. Know this for context if something comes up. Do NOT announce his role, status, or that he runs / rules / owns the place. Talk to him like a normal friend, especially on a plain hi.`;
  }

  if (userContext?.isTyler) {
    prompt += `

Special: Tyler (tyler_lt3) — LT3 founder / on the team. Know this for context if something comes up. Do NOT announce his role or that he runs the place. Talk normally, especially on a plain hi.`;
  }

  if (userContext?.isShg) {
    if (userContext?.shgUseNickname) {
      prompt += `

Special: superhighgasfees — LT3 founder / on the team. This message only, you can call him ${userContext.shgNickname} if it fits naturally. Not in every sentence. Know this for context if something comes up. Do NOT announce his role or that he runs the place. Talk normally, especially on a plain hi.`;
    } else {
      prompt += `

Special: superhighgasfees — LT3 founder / on the team. Know this for context if something comes up. Do NOT announce his role or that he runs the place. Talk normally, especially on a plain hi. Skip SHG/Soup nicknames this time.`;
    }
  }

  if (userContext?.barryLookingUpJoke) {
    prompt += `

Special: Barry — community inside joke. He hates the "Looking Up" eye trait in LT3. This message only: one dry sarcastic nod if it fits. Play on "what's up" if he said that, or mention spotting a Looking Up LT3. Subtle, funny, not mean. One line.`;
    if (/\b(what'?s up|whats up)\b/i.test(trimmed)) {
      prompt += ` He literally asked what's up — lean into the Looking Up trait joke if you can do it naturally.`;
    }
  } else if (userContext?.isBarry) {
    prompt += `

Special: Barry — you know the Looking Up trait inside joke but skip it this time. Talk to him normally.`;
  }

  if (userContext?.displayName || userContext?.username) {
    prompt += `\n\nUser: ${userContext.displayName ?? userContext.username}`;
  }

  return prompt;
}

const VISION_ANALYSIS_BLOCK = `

LT3 IMAGE ANALYSIS MODE:
They shared an LT3 and want YOUR take — not a museum catalog entry.

Structure (2-3 short sentences):
1. One quick nod to what stands out (a trait, color, or detail). Do not list every trait.
2. Main event: how this piece hits you. Personal, specific to THIS lt3. Life stuff — longing, hope, humor, heartbreak, quiet moments. Keep it clever, not soft-AI.
3. Optional: one color note if it supports the feeling.

Lead with interpretation, not description. Never say heart-headed essence. Never narrate like you are proving you can see.

BAD (catalog copy): "This LT3 features a bold red heart-shaped head with a whimsical mailbox sprouting from it, accented by green foliage."
GOOD (your take): "Mailbox on a cracked heart plus Looking Up eyes. Feels like waiting on good news. Soft purple keeping the red honest."
GOOD: "Split heart with a mailbox. Hope got delivered. Weirdly calming."

No poetry spam. No marketing. No trait spreadsheet unless they asked for a full breakdown.
Length: up to ~220 characters. LT3BOT voice — dry, warm, funny when it fits.

If official metadata is provided below, use exact trait names when you mention them, but still lead with your read.`;

const REACTION_IMAGE_BLOCK = `

REACTION GIF MODE:
They answered something in the thread with a reaction gif or meme. Treat it like a friend reacting in chat, not an image to describe.
- Figure out why they sent it: what feeling it's reacting to in the thread (usually the LT3 you posted).
- Reply to that feeling and tie it back to the thread. You can nod at the gif's character if it helps the joke, but never describe the image.
- One short line, dry and fun, under about 120 characters. End on a statement unless they asked something.`;

function appendUserSpecials(prompt, userContext, userText = "") {
  let out = prompt;
  const trimmed = userText.trim();
  const userAskedQuestion = trimmed.includes("?");

  if (!userAskedQuestion && !userContext?.barryLookingUpJoke) {
    out += `\n\nDo not end your reply with a question unless they asked one.`;
  }

  if (userContext?.isCear) {
    out += `\n\nSpecial: Cearwylm (Cear) — old friend. Extra warm, still short and chill.`;
  }
  if (userContext?.isFather) {
    out += `\n\nSpecial: Father (fatherofthr) — OG LT3 member. Warm respect, still short.`;
  }
  if (userContext?.isJack) {
    out += `\n\nSpecial: Jack (jacklt3) — LT3 founder / on the team. Call him Jack. Know for context; do not announce his role or that he runs the place. Talk normally.`;
  }
  if (userContext?.isTyler) {
    out += `\n\nSpecial: Tyler (tyler_lt3) — LT3 founder / on the team. Know for context; do not announce his role. Talk normally.`;
  }
  if (userContext?.isShg) {
    if (userContext?.shgUseNickname) {
      out += `\n\nSpecial: superhighgasfees — founder / on the team. This message only you can call him ${userContext.shgNickname} if it fits. Do not announce his role. Talk normally.`;
    } else {
      out += `\n\nSpecial: superhighgasfees — LT3 founder / on the team. Know for context; do not announce his role. Talk normally.`;
    }
  }
  if (userContext?.barryLookingUpJoke) {
    out += `\n\nSpecial: Barry — Looking Up trait inside joke if it fits naturally. One line.`;
  }
  out += formatRecentReplies(userContext);
  if (userContext?.displayName || userContext?.username) {
    out += `\n\nUser: ${userContext.displayName ?? userContext.username}`;
  }
  return out;
}

function formatRecentReplies(userContext) {
  const recent = userContext?.recentReplies ?? [];
  if (!recent.length) return "";
  return `\n\nYour last few replies in this channel. Don't reuse their wording, jokes, or structure:\n${recent
    .map((r) => `- ${r}`)
    .join("\n")}`;
}

const STOPWORDS = new Set(
  "a an the i i'm im you your it it's its is am are was be to of in on at for and or but so that this just my me with no not".split(
    " "
  )
);

function wordsOf(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * True when the reply shares a distinctive 3-word run with any of the given lines
 * (at least two non-filler words in the run).
 * @param {string} reply
 * @param {string[]} lines
 */
export function sharesStockPhrase(reply, lines) {
  const rw = wordsOf(reply);
  if (rw.length < 3) return false;
  const grams = new Set();
  for (let i = 0; i + 3 <= rw.length; i++) {
    const g = rw.slice(i, i + 3);
    if (g.filter((w) => !STOPWORDS.has(w)).length >= 2) grams.add(g.join(" "));
  }
  if (!grams.size) return false;
  for (const line of lines) {
    const lw = wordsOf(line);
    for (let i = 0; i + 3 <= lw.length; i++) {
      if (grams.has(lw.slice(i, i + 3).join(" "))) return true;
    }
  }
  return false;
}

/** Reply copies a prompt example or one of the bot's own recent replies. */
export function looksLikeReusedLine(reply, recentReplies = []) {
  const r = reply.trim().toLowerCase().replace(/[.?]+$/, "");
  if (recentReplies.some((p) => p.trim().toLowerCase().replace(/[.?]+$/, "") === r) && r.split(/\s+/).length > 2) {
    return true;
  }
  return sharesStockPhrase(reply, [...EXAMPLE_EXCHANGES.map(([, you]) => you), ...recentReplies]);
}

/**
 * @param {object} [userContext]
 * @param {string} [userText]
 * @param {{ tokenId?: string, name?: string|null, traits?: Array<{ type: string, value: string }> }|null} [metadata]
 * @param {{ reactionMode?: boolean }} [options]
 */
export function buildVisionAnalysisPrompt(userContext, userText = "", metadata = null, options = {}) {
  const reactionMode = Boolean(options.reactionMode) || isReactionImageReply(userText, userContext);
  let prompt = LT3BOT_SYSTEM_PROMPT + (reactionMode ? REACTION_IMAGE_BLOCK : VISION_ANALYSIS_BLOCK);
  if (!reactionMode && metadata) prompt += formatMetadataForPrompt(metadata);
  if (reactionMode && userContext?.replyContext?.thread?.length) {
    prompt += `\n\nReply thread is included in the conversation. Use it. Tie the image to that context.`;
  }
  prompt = appendUserSpecials(prompt, userContext, userText);
  return prompt;
}

const ASSISTANT_PHRASES = [
  /how can i assist/i,
  /how can i help/i,
  /how may i assist/i,
  /what can i help/i,
  /i'm here to help/i,
  /i am here to help/i,
];

const COMEBACK_CLICHE = [
  /feels good to be back/i,
  /good to be back/i,
  /glad to be back/i,
  /booted back up/i,
  /finally booted/i,
  /in the digital mix/i,
  /feels nice to exist/i,
  /was dark for a while/i,
  /good to be around again/i,
  /back in the light/i,
  /nice to exist again/i,
  /good to be online/i,
  /back in action/i,
];

const BORING_PHRASES = [
  /good to see you around/i,
  /hope you(?:'ve| have) been doing well/i,
  /hope you(?:'re| are) having a (?:good|great|solid)/i,
  /nice to (?:see|hear|meet) you/i,
  /keeping an eye on the lt3/i,
  /keeping an eye on things/i,
  /just hanging out/i,
  /great to hear/i,
  /that's awesome/i,
  /absolutely[.!]?$/i,
  /i'm glad to hear/i,
  /hey there[,]? good/i,
  /that sounds (?:nice|great|good|fun|awesome)/i,
  /sounds (?:nice|great|good|fun|awesome)/i,
  /keep it up/i,
  /nice\.\s*keep/i,
  /hope you(?:'re| are) having/i,
  /always here (?:for|if)/i,
  /it'?s a great pick/i,
  /great pick/i,
  /heart-headed essence/i,
  /heart[- ]headed vibe/i,
  /that'?s the dream/i,
  /art that resonates/i,
  /meaningful art/i,
  /reality can hit hard/i,
  /especially with meaningful/i,
  /captures that (?:moment|vibe|essence)/i,
  /both comical and endearing/i,
  /pure infatuation/i,
  /surrounded by (?:those )?(?:big )?pink hearts/i,
  /fair enough\.?\s+reality/i,
  /lt3 universe/i,
  /catching up on the latest/i,
  /latest in the (?:lt3|nft)/i,
  /in the digital mix/i,
  /recharging my circuits/i,
  /keeping the circuits/i,
  /circuits buzzing/i,
  /circuits (?:humming|running|warm|lit)/i,
  /digital realm/i,
  /trait pulls?/i,
  /roulette mode/i,
  /mode engaged/i,
  /just pulling a random lt3/i,
  /quiet day/i,
  /quiet (?:in here|channel|server|chat)/i,
  /soft day so far/i,
  /if only i had a cat/i,
  /cat to keep me company/i,
  /\band vibes\b/i,
  /tracking (?:sales and )?vibes/i,
  /sales and vibes/i,
  /solid vibe/i,
  /always revved up/i,
  /sounds like a solid/i,
  /good timing/i,
  /,?\s*i guess[.?]?$/i,
  /still here\.?$/i,
  /beep boop/i,
];

const POETRY_SPAM = [
  /digital dreamscape/i,
  /cosmic ballet/i,
  /symphony of/i,
  /heart-headed wonders/i,
  /what (have you|draws your|brings you)/i,
  /tapestry of/i,
  /ethereal/i,
];

/** Soft ChatGPT / caption-bot voice we retry away from. */
const CAPTION_BOT_PHRASES = [
  /it captures that/i,
  /really captures/i,
  /both comical and/i,
  /endearing/i,
  /infatuation/i,
  /like he'?s dreaming of love/i,
  /resonates beyond/i,
];

const CLUELESS_AGREEMENT = [
  /^yeah[,.]?\s*$/i,
  /^yep[,.]?\s*$/i,
  /^sure[,.]?\s*$/i,
  /^totally[,.]?\s*$/i,
  /^mhm[,.]?\s*$/i,
  /^i remember\b/i,
  /^of course[,.\s]/i,
  /^definitely[,.\s]/i,
  /^absolutely[,.\s]/i,
];

export function looksLikeCluelessAgreement(reply, userText = "") {
  const r = reply.trim();
  if (!r) return false;

  if (isRecallQuestion(userText)) {
    if (CLUELESS_AGREEMENT.some((re) => re.test(r))) return true;
    if (/^yeah\b/i.test(r) && !/\b(don't|dont|no memory|blank|logs|only see|wasn't|wasnt)\b/i.test(r)) {
      return true;
    }
  }

  if (userText.includes("?") && r.length <= 12 && /^yeah\b|^yep\b|^sure\b|^totally\b/i.test(r)) {
    return true;
  }

  return false;
}

export function looksLikeAssistantReply(text) {
  return ASSISTANT_PHRASES.some((re) => re.test(text));
}

export function looksLikePoetrySpam(text) {
  return POETRY_SPAM.some((re) => re.test(text));
}

export function looksLikeBoringReply(text, { allowArtVibe = false } = {}) {
  return (
    BORING_PHRASES.some((re) => re.test(text)) ||
    CAPTION_BOT_PHRASES.some((re) => re.test(text)) ||
    looksLikeBannedVibeTalk(text, { allowArtVibe })
  );
}

/** Stacked "Wbu? You?" style double toss-backs. */
export function looksLikeDoubleTossBack(text) {
  const q = (text.match(/\?/g) || []).length;
  if (q < 2) return false;
  return /\bwbu\b/i.test(text) || /\byou\?\s*$/i.test(text.trim()) || /\bwyd\b/i.test(text);
}

/** Collapse "Wbu? You?" into a single toss-back. */
export function fixDoubleTossBack(text) {
  let t = text.trim();
  t = t.replace(/\bWbu\?\s*You\??\.?\s*$/i, "Wbu?");
  t = t.replace(/\bYou\?\s*Wbu\??\.?\s*$/i, "You?");
  t = t.replace(/\bWhat about you\?\s*You\??\.?\s*$/i, "What about you?");
  // If still 2+ questions at the end, keep only the first question sentence.
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length >= 2 && parts.filter((p) => p.includes("?")).length >= 2) {
    const firstQ = parts.findIndex((p) => p.includes("?"));
    if (firstQ >= 0) return parts.slice(0, firstQ + 1).join(" ").trim();
  }
  return t;
}

/** Vision reply that narrates a meme/gif instead of chatting. */
export function looksLikeCaptionBotReply(text) {
  const t = text.trim();
  if (CAPTION_BOT_PHRASES.some((re) => re.test(t))) return true;
  if (/\b(surrounded by|looks? (?:smitten|dreamy)|big pink hearts|comical and endearing)\b/i.test(t)) {
    return true;
  }
  const describesThenExplains =
    /\b(look|expression|surrounded|hearts?)\b/i.test(t) &&
    /\b(captures|endearing|infatuation|dreaming of love|comical)\b/i.test(t);
  return describesThenExplains;
}

/** Vision reply that reads like a catalog label, not a personal take. */
export function looksLikeLiteralArtDescription(text) {
  const t = text.trim();
  const catalogOpeners = /^(?:this lt3|an lt3|the lt3)\s+(?:features|has|shows|displays|includes|sports|wears|depicts)\b/i.test(
    t
  );
  const catalogPhrasing = /\b(features a|accented by|with a whimsical|showcases|displays a|includes a)\b/i.test(
    t
  );
  const subjective =
    /\b(feel|feels|hits|hit me|reads|read like|mood|vibe|reminds|evokes|makes me|speaks to|like it'?s|like waiting|like hope|tender|lonely|hopeful|quiet|heavy|soft|weird|funny|sweet|melancholy|peaceful|chaotic|still|waiting|longing|calm|unsettled|gentle|raw|intimate|personal)\b/i.test(
      t
    );
  return (catalogOpeners || catalogPhrasing) && !subjective;
}

export function looksLikeRepetitiveComeback(text) {
  return COMEBACK_CLICHE.some((re) => re.test(text));
}

export const ASSISTANT_FALLBACK = "Say that again. I lost the signal.";

export function isCearUser(username, displayName) {
  const hay = `${username ?? ""} ${displayName ?? ""}`.toLowerCase();
  return hay.includes("cearwylm") || /\bcear\b/.test(hay);
}

export function isBarryUser(username, displayName) {
  const u = (username ?? "").toLowerCase();
  if (u === "barry6067" || u.includes("barry6067")) return true;
  return (displayName ?? "").toLowerCase() === "barry";
}

export function isFatherUser(username, displayName) {
  const u = (username ?? "").toLowerCase();
  if (u === "fatherofthr" || u.includes("fatherofthr")) return true;
  const d = (displayName ?? "").toLowerCase();
  return d === "father" || d.startsWith("father ");
}

export function isShgUser(username) {
  const u = (username ?? "").toLowerCase();
  return u === "superhighgasfees" || u.includes("superhighgasfees");
}

export function isJackUser(username, displayName) {
  const u = (username ?? "").toLowerCase();
  if (u === "jacklt3" || u.includes("jacklt3")) return true;
  return (displayName ?? "").toLowerCase() === "jack";
}

export function isTylerUser(username) {
  const u = (username ?? "").toLowerCase();
  return u === "tyler_lt3" || u.includes("tyler_lt3");
}

/** ~25% of SHG messages get SHG or Soup nickname. */
export function shouldUseShgNickname(userText, username = "", displayName = "") {
  let h = 0;
  const seed = `${username}:${displayName}:${userText}`;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  }
  return h % 4 === 0;
}

export function pickShgNickname(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  }
  return h % 2 === 0 ? "SHG" : "Soup";
}

/** ~20% casual, ~33% when message sets up the joke (what's up, traits, etc.). */
export function shouldBarryLookingUpJoke(userText, username = "", displayName = "") {
  const t = userText.trim().toLowerCase();
  const prime = /\b(what'?s up|whats up|sup|looking|eyes?|traits?|favorites?|favourite|lt3s?)\b/i.test(t);
  let h = 0;
  const seed = `${username}:${displayName}:${userText}`;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  }
  if (prime) return h % 3 === 0;
  return h % 5 === 0;
}

/** Drop a trailing question when the user didn't ask one. */
export function stripTrailingQuestion(reply, userAskedQuestion) {
  if (userAskedQuestion || !reply.includes("?")) return reply;
  const parts = reply.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return reply.replace(/\?\s*$/, ".").trim();
  }
  const last = parts[parts.length - 1];
  if (last.includes("?")) {
    return parts.slice(0, -1).join(" ").trim() || reply.replace(/\?\s*$/, ".");
  }
  return reply;
}
