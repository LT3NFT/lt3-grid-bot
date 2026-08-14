import {
  isCearUser,
  looksLikeAssistantReply,
  looksLikePoetrySpam,
  stripTrailingQuestion,
} from "../src/chat/systemPrompt.js";
import { sanitizeChatReply } from "../src/chat/sanitize.js";
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
assert("floor trigger", matchScriptedTrigger("what's the floor price")?.kind === "floor");
assert("egg trigger", matchScriptedTrigger("egg")?.kind === "egg");
assert("redirect trigger", matchScriptedTrigger("thoughts on the SEC")?.kind === "redirect");
assert("trading trigger", matchScriptedTrigger("any trading tips")?.kind === "trading");
assert("empty trigger", matchScriptedTrigger("   ")?.kind === "empty");

const noBang = sanitizeChatReply("Hello world! This is fine!");
assert("strips exclamation marks", !noBang.includes("!"));

const capped = sanitizeChatReply("a".repeat(250));
assert("caps length", capped.length <= 100);

assert("cear user detect", isCearUser("someone", "Cearwylm"));
assert("cear nickname detect", isCearUser("cearwylm", "Cear"));
assert("not cear", !isCearUser("jacklt3", "Jack"));

assert("assistant phrase detect", looksLikeAssistantReply("Hello. How can I assist you today?"));
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
