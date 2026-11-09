/**
 * Canonical LT3 artwork — same Pinata folder the sales bot / editorial use.
 * Prefer this over Alchemy/OpenSea CDN hops for every grid/GIF tile.
 */
export const LT3_IMAGE_IPFS_CID = "QmRYnu6yVbRPEk3yfkoQ11o1KAVjhxuP5FTs8gR58CE8nG";
export const LT3_PINATA_GATEWAY = `https://alchemy.mypinata.cloud/ipfs/${LT3_IMAGE_IPFS_CID}`;
export const LT3_DWEB_GATEWAY = `https://dweb.link/ipfs/${LT3_IMAGE_IPFS_CID}`;

export function lt3CanonicalImageUrl(tokenId) {
  const id = String(tokenId ?? "").trim();
  if (!/^\d+$/.test(id)) return null;
  return `${LT3_PINATA_GATEWAY}/${id}.png`;
}

export function lt3FallbackImageUrl(tokenId) {
  const id = String(tokenId ?? "").trim();
  if (!/^\d+$/.test(id)) return null;
  return `${LT3_DWEB_GATEWAY}/${id}.png`;
}

/**
 * Rewrite NFT stubs so image loaders hit Pinata first (token id → {cid}/{id}.png).
 * Keeps original media fields as lower-priority fallbacks.
 */
export function withCanonicalLt3ImageUrls(nfts) {
  if (!Array.isArray(nfts)) return [];
  return nfts.map((nft) => {
    const tokenId =
      nft?.tokenId != null && nft.tokenId !== ""
        ? String(nft.tokenId)
        : nft?.identifier != null && nft.identifier !== ""
          ? String(nft.identifier)
          : null;
    if (!tokenId || !/^\d+$/.test(tokenId)) return nft;
    const pinata = lt3CanonicalImageUrl(tokenId);
    const dweb = lt3FallbackImageUrl(tokenId);
    return {
      ...nft,
      tokenId,
      identifier: tokenId,
      // Candidate order in getNftImageUrlCandidates: display → image_url → … → original
      display_image_url: pinata,
      image_url: pinata,
      original_image_url: dweb,
    };
  });
}
