import { Events } from "discord.js";
import {
  CHAT_BLOCKED_CHANNEL_IDS,
  CHAT_CHANNEL_IDS,
  CHAT_ENABLED,
} from "../config.js";
import { buildChatReply } from "./respond.js";
import { getImageUrlsFromMessage } from "./messageImages.js";
import {
  isCearUser,
  isBarryUser,
  isFatherUser,
  isShgUser,
  isJackUser,
  isTylerUser,
  pickShgNickname,
  shouldBarryLookingUpJoke,
  shouldUseShgNickname,
} from "./systemPrompt.js";

function stripBotMention(content, client) {
  const botId = client.user?.id;
  if (!botId) return content.trim();
  return content
    .replace(new RegExp(`<@!?${botId}>`, "g"), "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAllowedChannel(channelId) {
  if (CHAT_BLOCKED_CHANNEL_IDS.has(channelId)) return false;
  if (CHAT_CHANNEL_IDS.size === 0) return true;
  return CHAT_CHANNEL_IDS.has(channelId);
}

async function isReplyToBot(message, client) {
  if (!message.reference?.messageId || !message.channel) return false;
  const cached = message.channel.messages.cache.get(message.reference.messageId);
  if (cached) return cached.author?.id === client.user?.id;
  try {
    const fetched = await message.channel.messages.fetch(message.reference.messageId);
    return fetched.author?.id === client.user?.id;
  } catch {
    return false;
  }
}

async function shouldRespond(message, client) {
  if (!message.guild) return false;
  if (message.author.bot) return false;
  if (!client.user) return false;
  if (!isAllowedChannel(message.channelId)) return false;

  const mentioned = message.mentions.users.has(client.user.id);
  if (mentioned) return true;
  return isReplyToBot(message, client);
}

async function handleChatMessage(message, client) {
  if (!(await shouldRespond(message, client))) return;

  const imageUrls = getImageUrlsFromMessage(message);
  const cleanText =
    stripBotMention(message.content, client) ||
    (imageUrls.length ? "What do you think of this LT3?" : "");
  const displayName = message.member?.displayName ?? message.author.globalName ?? message.author.username;
  const username = message.author.username;
  const isCear = isCearUser(username, displayName);
  const isBarry = isBarryUser(username, displayName);
  const isFather = isFatherUser(username, displayName);
  const isShg = isShgUser(username);
  const isJack = isJackUser(username, displayName);
  const isTyler = isTylerUser(username);
  const barryLookingUpJoke = isBarry && shouldBarryLookingUpJoke(cleanText, username, displayName);
  const shgUseNickname = isShg && shouldUseShgNickname(cleanText, username, displayName);
  const shgNickname = shgUseNickname ? pickShgNickname(`${username}:${cleanText}`) : null;

  try {
    const reply = await buildChatReply(cleanText, {
      username,
      displayName,
      isCear,
      isBarry,
      isFather,
      isShg,
      isJack,
      isTyler,
      barryLookingUpJoke,
      shgUseNickname,
      shgNickname,
      imageUrls,
    });
    await message.reply(reply);
  } catch (err) {
    console.error("[Chat] reply failed", err);
  }
}

export function wireChat(client) {
  if (!CHAT_ENABLED) {
    console.log("[Chat] disabled — set OPENAI_API_KEY and CHAT_ENABLED=true to enable.");
    return;
  }

  console.log("[Chat] enabled — responds to @mentions and replies; analyzes attached LT3 images.");

  client.on(Events.MessageCreate, (message) => {
    void handleChatMessage(message, client);
  });
}
