/**
 * Collect image URLs from a Discord message (attachments, then embeds).
 * @param {{ attachments: { values: () => Iterable<{ contentType?: string|null, url?: string|null, proxyURL?: string|null }> }, embeds?: Array<{ image?: { url?: string }, thumbnail?: { url?: string } }> }} message
 * @returns {string[]}
 */
export function getImageUrlsFromMessage(message) {
  const urls = [];

  for (const attachment of message.attachments.values()) {
    const contentType = attachment.contentType || "";
    const url = attachment.url || attachment.proxyURL || "";
    if (!url) continue;
    if (contentType.startsWith("image/") || /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)) {
      urls.push(url);
    }
  }

  if (urls.length) return urls.slice(0, 1);

  for (const embed of message.embeds || []) {
    if (embed.image?.url) return [embed.image.url];
    if (embed.thumbnail?.url) return [embed.thumbnail.url];
  }

  return [];
}
