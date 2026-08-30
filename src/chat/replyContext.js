/**
 * @param {import("discord.js").TextChannel | import("discord.js").NewsChannel | import("discord.js").ThreadChannel} channel
 * @param {string} messageId
 */
async function fetchReferencedMessage(channel, messageId) {
  const cached = channel.messages.cache.get(messageId);
  if (cached) return cached;
  return channel.messages.fetch(messageId);
}

function stripMentions(content, client) {
  const botId = client.user?.id;
  if (!botId) return content.trim();
  return content
    .replace(new RegExp(`<@!?${botId}>`, "g"), "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @returns {Promise<{ thread: Array<{ role: "user"|"assistant", content: string, author: string }>, replyingToBot: boolean }|null>}
 */
export async function fetchReplyThreadContext(message, client) {
  if (!message.reference?.messageId || !message.channel?.messages) return null;

  try {
    const ref = await fetchReferencedMessage(message.channel, message.reference.messageId);
    /** @type {Array<{ role: "user"|"assistant", content: string, author: string }>} */
    const thread = [];

    if (ref.reference?.messageId) {
      try {
        const parent = await fetchReferencedMessage(message.channel, ref.reference.messageId);
        const parentContent = stripMentions(parent.content ?? "", client);
        if (parentContent && !parent.author?.bot) {
          thread.push({
            role: "user",
            author: parent.member?.displayName ?? parent.author.username ?? "user",
            content: parentContent.slice(0, 400),
          });
        }
      } catch {
        // ignore missing parent
      }
    }

    const refContent = stripMentions(ref.content ?? "", client);
    if (!refContent) return thread.length ? { thread, replyingToBot: false } : null;

    const replyingToBot = ref.author?.id === client.user?.id;
    thread.push({
      role: replyingToBot ? "assistant" : "user",
      author: replyingToBot
        ? "LT3BOT"
        : ref.member?.displayName ?? ref.author.username ?? "user",
      content: refContent.slice(0, 400),
    });

    return { thread, replyingToBot };
  } catch {
    return null;
  }
}
