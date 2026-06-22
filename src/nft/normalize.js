const IPFS_HTTPS_GATEWAY = "https://ipfs.io/ipfs/";

export function ipfsPathToHttpsGateway(path) {
  const cleaned = String(path || "")
    .trim()
    .replace(/^ipfs\//, "");
  if (!cleaned) return null;
  return `${IPFS_HTTPS_GATEWAY}${encodeURI(cleaned)}`;
}

export function normalizeMediaUrl(raw) {
  if (raw == null || typeof raw !== "string") return null;
  let url = raw.trim();
  if (!url) return null;

  url = url
    .replace(/^https?:\/\/cloudflare-ipfs\.com\/ipfs\//i, IPFS_HTTPS_GATEWAY)
    .replace(/^https?:\/\/cf-ipfs\.com\/ipfs\//i, IPFS_HTTPS_GATEWAY);

  if (url.startsWith("ipfs://")) {
    return ipfsPathToHttpsGateway(url.slice("ipfs://".length));
  }
  return url;
}

function getAlchemyMediaImageCandidates(nft) {
  const media = nft?.media;
  if (!Array.isArray(media)) return [];
  const out = [];
  for (const entry of media) {
    if (entry?.gateway) out.push(entry.gateway);
    if (entry?.thumbnail) out.push(entry.thumbnail);
  }
  return out;
}

export function getNftImageUrlCandidates(nft) {
  if (!nft || typeof nft !== "object") return [];
  const img = nft.image;
  const raw = [
    nft.display_image_url,
    nft.image_url,
    ...(typeof img === "object" && img
      ? [img.cachedUrl, img.pngUrl, img.gateway, img.originalUrl, img.thumbnailUrl]
      : []),
    ...getAlchemyMediaImageCandidates(nft),
    typeof img === "string" ? img : null,
    nft.original_image_url,
    nft.metadata?.image,
    nft.metadata?.image_url,
    nft.raw?.metadata?.image,
    nft.raw?.metadata?.image_url,
  ];
  const seen = new Set();
  const out = [];
  for (const c of raw) {
    const u = normalizeMediaUrl(c);
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export function getBestNftImageUrl(nft) {
  const candidates = getNftImageUrlCandidates(nft);
  return candidates.length ? candidates[0] : null;
}

export function getNftTokenId(nft) {
  if (!nft) return null;
  if (nft.tokenId != null && nft.tokenId !== "") return nft.tokenId;
  if (nft.identifier != null && nft.identifier !== "") return nft.identifier;
  return null;
}

export function getNftContractAddressLc(nft) {
  if (!nft) return "";
  const c = nft.contract;
  if (typeof c === "string") return c.toLowerCase();
  if (c && typeof c === "object") {
    if (typeof c.address === "string") return c.address.toLowerCase();
    if (typeof c.contract_address === "string") return c.contract_address.toLowerCase();
  }
  return "";
}

function tokenIdToSortBigIntString(tokenId) {
  if (tokenId == null) return "0";
  const s = String(tokenId).trim();
  if (!s) return "0";
  if (/^0x[0-9a-fA-F]+$/.test(s)) {
    try {
      return BigInt(s).toString();
    } catch {
      return s;
    }
  }
  if (/^[0-9]+$/.test(s)) return s;
  try {
    return BigInt(s).toString();
  } catch {
    return s;
  }
}

export function compareNftByTokenId(a, b) {
  const sa = tokenIdToSortBigIntString(getNftTokenId(a));
  const sb = tokenIdToSortBigIntString(getNftTokenId(b));
  try {
    const ba = BigInt(sa);
    const bb = BigInt(sb);
    if (ba < bb) return -1;
    if (ba > bb) return 1;
    return 0;
  } catch {
    return sa.localeCompare(sb, undefined, { numeric: true });
  }
}
