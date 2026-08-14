import { isCollectionStatsQuestion } from "../src/chat/collectionStats.js";
import { maxCharsForInput } from "../src/chat/length.js";
import {
  isCearUser,
  isBarryUser,
  isFatherUser,
  isShgUser,
  isJackUser,
  isTylerUser,
  pickShgNickname,
  shouldUseShgNickname,
  isCoffeeOrMorningMessage,
  isLightheartedMessage,
  isRecallQuestion,
  isWelcomeBackMessage,
  looksLikeAssistantReply,
  looksLikeBoringReply,
  looksLikeCluelessAgreement,
  looksLikePoetrySpam,
  looksLikeRepetitiveComeback,
  looksLikeUnpromptedGreeting,
  shouldBarryLookingUpJoke,
  stripLeadingGreeting,
  stripTrailingQuestion,
  userGreetedFirst,
} from "../src/chat/systemPrompt.js";
import { sanitizeChatReply, trimToCompleteThought, looksCutOff } from "../src/chat/sanitize.js";
import { matchScriptedTrigger, SCRIPTED } from "../src/chat/triggers.js";

let failed = 0;

function assert(name, cond) {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    failed += 1;
  } else {
    console.log(`ok: ${name}`);
  }
}

assert("utility trigger", matchScriptedTrigger("what is the utility")?.kind === "utility");
assert("greeting trigger gm", matchScriptedTrigger("gm")?.kind === "greeting");
assert("greeting trigger hey", matchScriptedTrigger("hey")?.kind === "greeting");
assert("greeting cap", maxCharsForInput("gm", { isGreeting: true }) >= 80);
assert("short input cap", maxCharsForInput("gm") >= 60);
assert("conversational cap", maxCharsForInput("what you been up to") >= 110);
assert("longer input cap", maxCharsForInput("chilling and looking at lt3s i like") >= 50);
assert("floor trigger", matchScriptedTrigger("what's the floor price")?.kind === "stats");
assert("listed trigger", matchScriptedTrigger("how many are listed")?.kind === "stats");
assert("listed lt3 trigger", matchScriptedTrigger("how many lt3s are listed")?.kind === "stats");
assert("stats fallback detect", isCollectionStatsQuestion("how many LT3s are listed on OpenSea"));
assert("owners trigger", matchScriptedTrigger("how many owners does lt3 have")?.kind === "stats");
assert("egg trigger", matchScriptedTrigger("egg")?.kind === "egg");
assert("egg trigger with period", matchScriptedTrigger("egg.")?.kind === "egg");
assert("egg name question not trigger", matchScriptedTrigger("what would a clever egg name be for superhighgasfees")?.kind !== "egg");
assert("egg emoji trigger", matchScriptedTrigger("🥚")?.kind === "egg");
assert("tyler trigger", matchScriptedTrigger("tyler")?.kind === "tyler");
assert("tyler trigger period", matchScriptedTrigger("tyler.")?.kind === "tyler");
assert("tyler name question not trigger", matchScriptedTrigger("where is tyler")?.kind !== "tyler");
assert("tyler reply lowercase", sanitizeChatReply("tyler", { preserveCase: true }) === "tyler");
assert("redirect trigger", matchScriptedTrigger("thoughts on the SEC")?.kind === "redirect");
assert("trading trigger", matchScriptedTrigger("any trading tips")?.kind === "trading");
assert("empty trigger", matchScriptedTrigger("   ")?.kind === "empty");

const noBang = sanitizeChatReply("Hello world! This is fine!");
assert("strips exclamation marks", !noBang.includes("!"));

const multiCap = sanitizeChatReply("gm. good to see you.");
assert("capitalizes sentences", multiCap.startsWith("Gm") && multiCap.includes(". Good"));

const noDash = sanitizeChatReply("Sure — here's a name — hope that helps.");
assert("strips em dashes", !noDash.includes("—") && !noDash.includes("–"));

const orphanQuote = sanitizeChatReply("Call it 'Premium Suffering.");
assert("fixes orphan open quote", !orphanQuote.includes("'") && orphanQuote.includes("Premium Suffering"));

const keepsApostrophe = sanitizeChatReply("Don't mention it. It's fine.");
assert("keeps apostrophes", keepsApostrophe.includes("Don't") && keepsApostrophe.includes("It's"));

const pairedQuote = sanitizeChatReply('Try "GasFee McEggerson" for that.');
assert("strips paired quotes", !pairedQuote.includes('"') && pairedQuote.includes("GasFee"));

const capped = sanitizeChatReply("a".repeat(250));
assert("caps length", capped.length <= 100);

const twoSentences = sanitizeChatReply(
  "See any LT3s you like today? Maybe one that is looking up at the sky right now",
  { maxChars: 45 }
);
assert("trim ends at sentence", twoSentences.endsWith("?"));
assert("trim not mid thought", !twoSentences.toLowerCase().includes("maybe"));

const cutOff = trimToCompleteThought("Mostly vibing and running the grid for fun with moss", 40);
assert("trim closes thought", cutOff.endsWith("."));

assert("cut off detect", looksCutOff("Maybe one that is looking"));
assert("complete detect", !looksCutOff("Maybe one that is looking."));

assert("cear user detect", isCearUser("someone", "Cearwylm"));
assert("cear nickname detect", isCearUser("cearwylm", "Cear"));
assert("not cear", !isCearUser("jacklt3", "Jack"));
assert("barry username detect", isBarryUser("Barry6067", "Barry"));
assert("barry display detect", isBarryUser("someone", "Barry"));
assert("not barry", !isBarryUser("jacklt3", "Jack"));
assert("father username detect", isFatherUser("fatherofthr", "Father"));
assert("father display detect", isFatherUser("someone", "Father"));
assert("not father", !isFatherUser("jacklt3", "Jack"));
assert("shg username detect", isShgUser("superhighgasfees"));
assert("jack founder detect", isJackUser("jacklt3", "JackLT3"));
assert("tyler founder detect", isTylerUser("tyler_lt3"));
assert("shg nickname pick", pickShgNickname("test") === "SHG" || pickShgNickname("test") === "Soup");
assert(
  "shg nickname deterministic",
  shouldUseShgNickname("gm", "superhighgasfees", "SHG") ===
    shouldUseShgNickname("gm", "superhighgasfees", "SHG")
);
assert("barry joke whats up sometimes", shouldBarryLookingUpJoke("what's up", "Barry6067", "Barry") !== undefined);
assert(
  "barry joke deterministic",
  shouldBarryLookingUpJoke("what's up", "Barry6067", "Barry") ===
    shouldBarryLookingUpJoke("what's up", "Barry6067", "Barry")
);

assert("assistant phrase detect", looksLikeAssistantReply("Hello. How can I assist you today?"));
assert("boring phrase detect", looksLikeBoringReply("Hey there, good to see you around."));
assert("boring vibe detect", looksLikeBoringReply("Just hanging out, keeping an eye on the LT3 vibe."));
assert("comeback cliche detect", looksLikeRepetitiveComeback("Yeah, I was dark for a while. Feels good to be back."));
assert("comeback cliche detect 2", looksLikeRepetitiveComeback("Glad to be back in the digital mix."));
assert("welcome back detect", isWelcomeBackMessage("omg you're back"));
assert("recall question detect", isRecallQuestion("do you remember what I said earlier"));
assert("clueless yeah detect", looksLikeCluelessAgreement("Yeah.", "do you remember what we talked about"));
assert("honest recall ok", !looksLikeCluelessAgreement("No memory on that. I only see this message.", "what did I say"));
assert("welcome back missed", isWelcomeBackMessage("I was so lost without you"));
assert("welcome back thanks", isWelcomeBackMessage("thank you for being here"));
assert("lighthearted lol", isLightheartedMessage("lol that's hilarious"));
assert("lighthearted name ask", isLightheartedMessage("what would a clever egg name be for superhighgasfees"));
assert("coffee morning detect", isCoffeeOrMorningMessage("just grabbed my coffee"));
assert("motor oil detect", isCoffeeOrMorningMessage("you prefer motor oil right"));
assert("user greeted hey", userGreetedFirst("hey what's good"));
assert("user not greeted", !userGreetedFirst("what you been up to"));
assert("unprompted greeting detect", looksLikeUnpromptedGreeting("Hey. Mostly vibing today."));
assert("strip leading greeting", stripLeadingGreeting("Hey. Mostly vibing today.") === "Mostly vibing today.");
assert("poetry spam detect", looksLikePoetrySpam("Another day in the digital dreamscape"));

assert(
  "strip trailing question",
  stripTrailingQuestion("Nice pick. What draws your eye?", false) === "Nice pick."
);
assert(
  "keep question if user asked",
  stripTrailingQuestion("Floor is 0.04. Want more?", true).includes("?")
);

const egg = sanitizeChatReply("🥚", { allowEgg: true });
assert("keeps egg emoji", egg.includes("🥚"));

assert("utility copy exact", SCRIPTED.utility.includes("they will spam your dms"));

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll chat tests passed.");
