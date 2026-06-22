import {
  LT3_ALCHEMY_KEY,
  LT3_CONTRACT_LC,
  MAX_NFT_OWNER_PAGES,
} from "../config.js";
import { compareNftByTokenId, getNftContractAddressLc } from "./normalize.js";

async function fetchLt3NftsPage(ownerAddress, pageKey) {
  const url = new URL(
    `https://eth-mainnet.g.alchemy.com/nft/v3/${encodeURIComponent(LT3_ALCHEMY_KEY)}/getNFTsForOwner`
  );
  url.searchParams.set("owner", ownerAddress);
  url.searchParams.append("contractAddresses[]", LT3_CONTRACT_LC);
  if (pageKey) url.searchParams.set("pageKey", pageKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      detail = res.statusText;
    }
    const err = new Error(`Alchemy request failed (${res.status}). ${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchAllLt3NftsForOwner(ownerAddress) {
  if (!LT3_ALCHEMY_KEY) {
    throw new Error("LT3_ALCHEMY_KEY is not configured.");
  }

  const collected = [];
  let pageKey;
  let pageCount = 0;

  do {
    pageCount += 1;
    if (pageCount > MAX_NFT_OWNER_PAGES) {
      console.warn("Alchemy NFT pagination: stopped at max pages");
      break;
    }
    const data = await fetchLt3NftsPage(ownerAddress, pageKey);
    const page = Array.isArray(data.ownedNfts) ? data.ownedNfts : [];
    for (const nft of page) {
      if (getNftContractAddressLc(nft) === LT3_CONTRACT_LC) {
        collected.push(nft);
      }
    }
    pageKey = data.pageKey || undefined;
  } while (pageKey);

  collected.sort(compareNftByTokenId);
  return collected;
}
