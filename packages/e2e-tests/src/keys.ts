import { ethers } from "ethers";

export const KEYS = [
  "0000000000000000000000000000000000000000000000000000000000000001",
  "0000000000000000000000000000000000000000000000000000000000000002",
  "0000000000000000000000000000000000000000000000000000000000000003",
  "0000000000000000000000000000000000000000000000000000000000000004",
  "0000000000000000000000000000000000000000000000000000000000000005",
];

export function KEYS_TO_WALLETS(
  provider: ethers.providers.Provider
): ethers.Wallet[] {
  return KEYS.map((k) => new ethers.Wallet(k, provider));
}