import { Address, AssetType } from "@nocturne-xyz/sdk";
import { ethers } from "ethers";
import ERC20 from "./abis/ERC20.json";
import ERC721 from "./abis/ERC721.json";
import ERC1155 from "./abis/ERC1155.json";

export interface TokenDetails {
  decimals: number;
  symbol: string;
}

export const SNAP_ID =
  process.env.REACT_APP_SNAP_ORIGIN ?? `local:http://localhost:8080`;

export async function getWindowSigner(): Promise<ethers.Signer> {
  const provider = new ethers.providers.Web3Provider(window.ethereum as any);
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
}

export function getTokenContract(
  assetType: AssetType,
  assetAddress: Address,
  signerOrProvider: ethers.Signer | ethers.providers.Provider
): ethers.Contract {
  let abi;
  if (assetType == AssetType.ERC20) {
    abi = ERC20;
  } else if (assetType == AssetType.ERC721) {
    abi = ERC721;
  } else if (assetType == AssetType.ERC1155) {
    abi = ERC1155;
  } else {
    throw new Error(`Unknown asset type: ${assetType}`);
  }

  return new ethers.Contract(assetAddress, abi, signerOrProvider);
}

export async function getTokenDetails(
  assetType: AssetType,
  assetAddress: Address,
  signerOrProvider: ethers.Signer | ethers.providers.Provider
): Promise<TokenDetails> {
  console.log("Getting token contract...");
  const tokenContract = getTokenContract(
    assetType,
    assetAddress,
    signerOrProvider
  );

  if (assetType == AssetType.ERC20) {
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();
    return { decimals, symbol };
  } else if (assetType == AssetType.ERC721) {
    const symbol = await tokenContract.symbol();
    return { decimals: 1, symbol };
  } else if (assetType == AssetType.ERC1155) {
    return { decimals: 1, symbol: "" };
  } else {
    throw new Error(`Unknown asset variant: ${assetType}`);
  }
}

export function formatTokenAmountUserRepr(
  balance: bigint,
  decimals: number
): number {
  return Number(balance) / Math.pow(10, decimals);
}

export function formatTokenAmountEvmRepr(
  amount: number,
  decimals: number
): bigint {
  return BigInt(amount * Math.pow(10, decimals));
}

export function formatAbbreviatedAddress(address: string): string {
  return (
    address.substring(0, 6) +
    "..." +
    address.substring(address.length - 4)
  ).toLowerCase();
}