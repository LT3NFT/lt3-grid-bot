import { providers } from "ethers";
import { LT3_ALCHEMY_KEY } from "../config.js";
import { isValidEvmAddress } from "../util/wallet-input.js";

export async function resolveEnsToAddress(ensQuery) {
  const name = String(ensQuery || "").trim();
  if (!name) {
    return { error: "Missing ENS name." };
  }

  const rpcUrl = LT3_ALCHEMY_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${encodeURIComponent(LT3_ALCHEMY_KEY)}`
    : "https://cloudflare-eth.com";

  try {
    const provider = new providers.JsonRpcProvider(rpcUrl);
    const address = await provider.resolveName(name);
    if (!address || !isValidEvmAddress(address)) {
      return { error: "Could not resolve that to an Ethereum address." };
    }
    return { address: address.toLowerCase() };
  } catch (e) {
    console.warn("resolve-ens", e);
    return { error: "Could not resolve that name. Try a .eth name or your 0x wallet address." };
  }
}
