import { Events } from "discord.js";
import {
  CHAT_BLOCKED_CHANNEL_IDS,
  CHAT_CHANNEL_IDS,
  CHAT_ENABLED,
} from "../config.js";
import { buildChatReply } from "./respond.js";
import { fetchReplyThreadContext } from "./replyContext.js";
import { buildTraitGridReplyQueued, buildTraitSingleReplyQueued, isTraitGridRequest, isTraitSingleRequest } from "./traitGrid.js";
import { buildRarityGridReplyQueued, isRarityGridRequest } from "./rarityGrid.js";
import { getImageUrlsFromMessage } from "./messageImages.js";
import { getRecentReplies, recordReply } from "./recentReplies.js";
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

/** Discord typing lasts ~10s — refresh until the reply finishes. */
function startTypingKeepalive(channel) {
  if (!channel?.sendTyping) return () => {};
  let stopped = false;
  const pulse = async () => {
    while (!stopped) {
      try {
        await channel.sendTyping();
      } catch {
        // channel gone / missing perms — stop quietly
        break;
      }
      await new Promise((r) => setTimeout(r, 8000));
    }
  };
  void pulse();
  return () => {
    stopped = true;
  };
}

async function handleChatMessage(message, client) {
  if (!(await shouldRespond(message, client))) return;

  const stopTyping = startTypingKeepalive(message.channel);

  try {
    const imageUrls = getImageUrlsFromMessage(message);
    const displayName = message.member?.displayName ?? message.author.globalName ?? message.author.username;
    const username = message.author.username;
    const replyContext = await fetchReplyThreadContext(message, client);

    let cleanText = stripBotMention(message.content, client);
    if (!cleanText && imageUrls.length) {
      // Don't force "analyze this LT3" on reaction gifs in a reply thread.
      cleanText = replyContext?.replyingToBot
        ? "(sent a reaction image/gif with no text)"
        : "(shared an image)";
    }

    const isCear = isCearUser(username, displayName);
    const isBarry = isBarryUser(username, displayName);
    const isFather = isFatherUser(username, displayName);
    const isShg = isShgUser(username);
    const isJack = isJackUser(username, displayName);
    const isTyler = isTylerUser(username);
    const barryLookingUpJoke = isBarry && shouldBarryLookingUpJoke(cleanText, username, displayName);
    const shgUseNickname = isShg && shouldUseShgNickname(cleanText, username, displayName);
    const shgNickname = shgUseNickname ? pickShgNickname(`${username}:${cleanText}`) : null;

    if (imageUrls.length === 0) {
      try {
        if (isRarityGridRequest(cleanText)) {
          console.log("[Chat] rarity grid request:", cleanText.slice(0, 120));
          const rarityReply = await buildRarityGridReplyQueued(cleanText);
          if (rarityReply) {
            await message.reply({ content: rarityReply.caption, files: [rarityReply.attachment] });
            return;
          }
        }

        if (isTraitGridRequest(cleanText)) {
          const gridReply = await buildTraitGridReplyQueued(cleanText);
          if (gridReply) {
            await message.reply({ content: gridReply.caption, files: [gridReply.attachment] });
            return;
          }
        }

        if (isTraitSingleRequest(cleanText)) {
          const singleReply = await buildTraitSingleReplyQueued(cleanText);
          if (singleReply) {
            await message.reply({ content: singleReply.caption, files: [singleReply.attachment] });
            return;
          }
        }
      } catch (err) {
        console.error("[Chat] trait/rarity grid failed", err);
        const msg =
          err instanceof Error && err.message ? err.message : "Could not pull that LT3.";
        await message.reply(msg);
        return;
      }
    }

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
      replyContext,
      recentReplies: getRecentReplies(message.channelId),
    });
    await message.reply(reply);
    recordReply(message.channelId, reply);
  } catch (err) {
    console.error("[Chat] reply failed", err);
  } finally {
    stopTyping();
  }
}

export function wireChat(client) {
  if (!CHAT_ENABLED) {
    console.log("[Chat] disabled — set OPENAI_API_KEY and CHAT_ENABLED=true to enable.");
    return;
  }

  console.log("[Chat] enabled — @mentions and replies; trait pulls and grids; LT3 image analysis.");

  client.on(Events.MessageCreate, (message) => {
    void handleChatMessage(message, client);
  });
}
