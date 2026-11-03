import { providers } from "ethers";
import { LT3_ALCHEMY_KEY } from "../config.js";
import { isValidEvmAddress } from "../util/wallet-input.js";

const FALLBACK_RPCS = [
  "https://ethereum.publicnode.com",
  "https://cloudflare-eth.com",
];

export async function resolveEnsToAddress(ensQuery) {
  const name = String(ensQuery || "").trim();
  if (!name) {
    return { error: "Missing ENS name." };
  }

  const rpcUrls = [
    ...(LT3_ALCHEMY_KEY
      ? [`https://eth-mainnet.g.alchemy.com/v2/${encodeURIComponent(LT3_ALCHEMY_KEY)}`]
      : []),
    ...FALLBACK_RPCS,
  ];

  let lastError = null;
  for (const rpcUrl of rpcUrls) {
    try {
      const provider = new providers.JsonRpcProvider(rpcUrl);
      const address = await provider.resolveName(name);
      if (!address || !isValidEvmAddress(address)) {
        lastError = new Error("unresolved");
        continue;
      }
      return { address: address.toLowerCase() };
    } catch (e) {
      lastError = e;
      console.warn("resolve-ens", rpcUrl, e?.message || e);
    }
  }

  console.warn("resolve-ens failed", lastError);
  return { error: "Could not resolve that name. Try a .eth name or your 0x wallet address." };
}
