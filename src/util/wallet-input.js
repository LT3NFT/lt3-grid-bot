import { MAX_WALLET_INPUT_CHARS } from "../config.js";

export function isValidEvmAddress(addr) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(addr || "").trim());
}

export function looksLikeEns(name) {
  const s = String(name || "").trim();
  return s.includes(".") && !/^0x/i.test(s);
}

export function normalizeWalletAddressInput(addr) {
  let s = String(addr ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "");
  s = s.trim().replace(/\s+/g, " ");
  if (s.length > MAX_WALLET_INPUT_CHARS) {
    s = s.slice(0, MAX_WALLET_INPUT_CHARS);
  }
  const uriAddr = s.match(/^ethereum:(0x[a-fA-F0-9]{40})(?:@|$|[?#])/i);
  if (uriAddr) return uriAddr[1].toLowerCase();
  const embedded = s.match(/0x[a-fA-F0-9]{40}/i);
  if (embedded) return embedded[0].toLowerCase();
  return s.trim();
}

export function getWalletInputPrecheckMessage(addrRaw) {
  const s = String(addrRaw || "").trim();
  if (!s) return "Enter an Ethereum address or ENS.";
  if (/^0x/i.test(s)) {
    if (!/^0x[a-fA-F0-9]+$/i.test(s)) {
      return "Address can only contain 0x and hex digits (0–9, a–f).";
    }
    if (s.length !== 42) {
      return `That address is the wrong length (${s.length} characters). Use 0x plus 40 hex digits, or ENS (e.g. name.eth).`;
    }
    return null;
  }
  if (looksLikeEns(s)) return null;
  return "Enter a valid 0x wallet address or ENS name (e.g. name.eth).";
}

export function toApiWalletAddress(validatedAddr) {
  return String(validatedAddr || "").trim().toLowerCase();
}
