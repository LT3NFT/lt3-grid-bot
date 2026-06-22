import { resolveEnsToAddress } from "../nft/resolve-ens.js";
import {
  getWalletInputPrecheckMessage,
  isValidEvmAddress,
  looksLikeEns,
  normalizeWalletAddressInput,
  toApiWalletAddress,
} from "./wallet-input.js";

export async function resolveWalletInput(rawInput) {
  const normalized = normalizeWalletAddressInput(rawInput);
  const precheck = getWalletInputPrecheckMessage(normalized);

  if (isValidEvmAddress(normalized)) {
    return { address: toApiWalletAddress(normalized), display: normalized };
  }
  if (looksLikeEns(normalized)) {
    const result = await resolveEnsToAddress(normalized);
    if (result.error) throw new Error(result.error);
    return { address: result.address, display: normalized };
  }
  throw new Error(precheck || "Enter a valid 0x wallet address or ENS name.");
}

export function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}
