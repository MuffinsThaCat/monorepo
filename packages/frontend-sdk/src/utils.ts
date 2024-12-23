import { loadNocturneConfigBuiltin } from "@nocturne-xyz/config";
import {
  Address,
  AssetTrait,
  AssetType,
  DepositRequest,
  PreSignOperation,
  DepositRequestStatus as ScreenerDepositRequestStatus,
  SignedOperation,
  SubmittableOperationWithNetworkInfo,
} from "@nocturne-xyz/core";
import { GetNotesOpts } from "@nocturne-xyz/client";
import { ethers } from "ethers";
import ERC1155 from "./abis/ERC1155.json";
import ERC20 from "./abis/ERC20.json";
import ERC721 from "./abis/ERC721.json";
import {
  DepositRequestStatus,
  NocturneSdkConfig,
  SupportedNetwork,
  Endpoints,
  TokenDetails,
  DisplayDepositRequest,
  OnChainDepositRequestStatus,
  GetBalanceOpts,
} from "./types";

const ENDPOINTS = {
  mainnet: {
    screenerEndpoint:
      process.env.NEXT_PUBLIC_SCREENER_URL ??
      "https://screener.mainnet.nocturnelabs.xyz",
    bundlerEndpoint:
      process.env.NEXT_PUBLIC_BUNDLER_URL ??
      "https://bundler.mainnet.nocturnelabs.xyz",
    subgraphEndpoint: process.env.NEXT_PUBLIC_SUBGRAPH_URL,
  },
  goerli: {
    screenerEndpoint:
      process.env.NEXT_PUBLIC_SCREENER_URL ??
      "https://screener.testnet.nocturnelabs.xyz",
    bundlerEndpoint:
      process.env.NEXT_PUBLIC_BUNDLER_URL ??
      "https://bundler.testnet.nocturnelabs.xyz",
    subgraphEndpoint: process.env.NEXT_PUBLIC_SUBGRAPH_URL,
  },
  localhost: {
    screenerEndpoint: "http://localhost:3001",
    bundlerEndpoint: "http://localhost:3000",
    subgraphEndpoint: "http://localhost:8000/subgraphs/name/nocturne",
  },
};

export function getTokenContract(
  assetType: AssetType,
  assetAddress: Address,
  signerOrProvider: ethers.Signer | ethers.providers.Provider,
): ethers.Contract {
  let abi;
  if (assetType == AssetType.ERC20) {
    abi = ERC20;
  } else if (assetType == AssetType.ERC721) {
    abi = ERC721;
  } else if (assetType == AssetType.ERC1155) {
    abi = ERC1155;
  } else {
    throw new Error(`unknown asset type: ${assetType}`);
  }

  return new ethers.Contract(assetAddress, abi, signerOrProvider);
}

export async function getTokenDetails(
  assetType: AssetType,
  assetAddress: Address,
  signerOrProvider: ethers.Signer | ethers.providers.Provider,
): Promise<TokenDetails> {
  console.log("getting token contract...");
  const tokenContract = getTokenContract(
    assetType,
    assetAddress,
    signerOrProvider,
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
    throw new Error(`unknown asset variant: ${assetType}`);
  }
}

export function formatTokenAmountUserRepr(
  balance: bigint,
  decimals: number,
): number {
  return Number(balance) / Math.pow(10, decimals);
}

export function formatTokenAmountEvmRepr(
  amount: number,
  decimals: number,
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

export interface CircuitArtifactUrlsInner {
  wasm: string;
  zkey: string;
  vkey: string;
}

export interface CircuitArtifactUrls {
  joinSplit: CircuitArtifactUrlsInner;
  canonAddrSigCheck: CircuitArtifactUrlsInner;
}

export function getCircuitArtifactUrls(
  networkName: SupportedNetwork,
): CircuitArtifactUrls {
  switch (networkName) {
    case "mainnet":
      return {
        joinSplit: {
          wasm: "https://nocturne-circuit-artifacts-mainnet.s3.amazonaws.com/joinsplit/joinsplit.wasm",
          zkey: "https://nocturne-circuit-artifacts-mainnet.s3.amazonaws.com/joinsplit/joinsplit.zkey",
          vkey: "https://nocturne-circuit-artifacts-mainnet.s3.amazonaws.com/joinsplit/joinsplitVkey.json",
        },
        canonAddrSigCheck: {
          wasm: "https://nocturne-circuit-artifacts-mainnet.s3.amazonaws.com/canonAddrSigCheck/canonAddrSigCheck.wasm",
          zkey: "https://nocturne-circuit-artifacts-mainnet.s3.amazonaws.com/canonAddrSigCheck/canonAddrSigCheck.zkey",
          vkey: "https://nocturne-circuit-artifacts-mainnet.s3.amazonaws.com/canonAddrSigCheck/canonAddrSigCheckVkey.json",
        },
      };
    case "goerli":
      return {
        joinSplit: {
          wasm: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/joinsplit/joinsplit.wasm",
          zkey: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/joinsplit/joinsplit.zkey",
          vkey: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/joinsplit/joinsplitVkey.json",
        },
        canonAddrSigCheck: {
          wasm: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheck.wasm",
          zkey: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheck.zkey",
          vkey: "https://nocturne-circuit-artifacts-goerli.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheckVkey.json",
        },
      };
    case "localhost":
      return {
        joinSplit: {
          wasm: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/joinsplit/joinsplit.wasm",
          zkey: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/joinsplit/joinsplit.zkey",
          vkey: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/joinsplit/joinsplitVkey.json",
        },
        canonAddrSigCheck: {
          wasm: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheck.wasm",
          zkey: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheck.zkey",
          vkey: "https://nocturne-circuit-artifacts-localhost.s3.us-east-2.amazonaws.com/canonAddrSigCheck/canonAddrSigCheckVkey.json",
        },
      };
    default:
      throw new Error(`Network not supported: ${networkName}`);
  }
}

export function getNocturneSdkConfig(
  networkName: SupportedNetwork,
): NocturneSdkConfig {
  const config = loadNocturneConfigBuiltin(networkName);

  let endpoints: Endpoints;
  switch (networkName) {
    case "mainnet":
      if (!ENDPOINTS.mainnet.subgraphEndpoint) {
        throw new Error(
          `Missing subgraph endpoint for network: ${networkName}`,
        );
      }

      endpoints = ENDPOINTS.mainnet as Endpoints;
      break;
    case "goerli":
      if (!ENDPOINTS.goerli.subgraphEndpoint) {
        throw new Error(
          `Missing subgraph endpoint for network: ${networkName}`,
        );
      }

      endpoints = ENDPOINTS.goerli as Endpoints;
      break;
    case "localhost":
      endpoints = ENDPOINTS.localhost;
      break;
    default:
      throw new Error(`Network not supported: ${networkName}`);
  }

  return {
    config,
    endpoints,
  };
}

export function toDepositRequest(
  displayDepositRequest: DisplayDepositRequest,
): DepositRequest {
  const asset = {
    ...displayDepositRequest.asset,
    id: displayDepositRequest.asset.id.toBigInt(),
  };
  return {
    spender: displayDepositRequest.spender,
    encodedAsset: AssetTrait.encode(asset),
    value: displayDepositRequest.value.toBigInt(),
    depositAddr: {
      h1: displayDepositRequest.depositAddr.h1.toBigInt(),
      h2: displayDepositRequest.depositAddr.h2.toBigInt(),
    },
    nonce: displayDepositRequest.nonce.toBigInt(),
    gasCompensation: displayDepositRequest.gasCompensation.toBigInt(),
  };
}

export function flattenDepositRequestStatus(
  subgraphStatus: OnChainDepositRequestStatus,
  screenerStatus: ScreenerDepositRequestStatus,
): DepositRequestStatus {
  switch (subgraphStatus) {
    case OnChainDepositRequestStatus.Retrieved:
      return DepositRequestStatus.Retrieved;
    case OnChainDepositRequestStatus.Completed:
      return DepositRequestStatus.Complete;
    case OnChainDepositRequestStatus.Pending: {
      switch (screenerStatus) {
        case ScreenerDepositRequestStatus.DoesNotExist:
          return DepositRequestStatus.Initiated;
        case ScreenerDepositRequestStatus.FailedScreen:
          return DepositRequestStatus.FailedScreen;
        case ScreenerDepositRequestStatus.PassedFirstScreen:
        case ScreenerDepositRequestStatus.AwaitingFulfillment:
          return DepositRequestStatus.AwaitingFulfillment;
        case ScreenerDepositRequestStatus.Completed:
          return DepositRequestStatus.Complete;
        default:
          throw new Error(`Unknown screener status: ${screenerStatus}`);
      }
    }
    default:
      throw new Error(`Unknown subgraph status: ${subgraphStatus}`);
  }
}

// TODO: flatten these two option types and change all tests to expect new behavior
export function getBalanceOptsToGetNotesOpts({
  includeUncommitted,
  includePending,
}: GetBalanceOpts): GetNotesOpts {
  return {
    includeUncommitted,
    ignoreOptimisticNFs: !includePending,
  };
}

export const BUNDLER_RECEIVED_OP_BUFFER: number = 90 * 1000; // 90 seconds (used to detect dropped ops)


// TODO replace this with better operation types
export type OperationKind = "PreSign" | "Signed" | "Submittable"
export function getOperationKind(op: PreSignOperation | SignedOperation | SubmittableOperationWithNetworkInfo): OperationKind {
  if ("gasFeeEstimate" in op) {
    return "PreSign";
  }

  if ("trackedAssets" in op) {
    return "Submittable";
  }

  return "Signed";
}
