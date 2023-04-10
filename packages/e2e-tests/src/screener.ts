import { ethers } from "ethers";
import { makeRedisInstance } from "./utils";
import {
  DepositScreenerProcessor,
  SubgraphScreenerSyncAdapter,
} from "@nocturne-xyz/deposit-screener";

export interface DepositScreenerConfig {
  depositManagerAddress: string;
  subgraphUrl: string;
  rpcUrl: string;
  attestationSignerKey: string;
  txSignerKey: string;
}

const { getRedis, clearRedis } = makeRedisInstance();

export async function startDepositScreener(
  config: DepositScreenerConfig
): Promise<() => Promise<void>> {
  const {
    depositManagerAddress,
    subgraphUrl,
    rpcUrl,
    attestationSignerKey,
    txSignerKey,
  } = config;

  const adapter = new SubgraphScreenerSyncAdapter(subgraphUrl);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const txSigner = new ethers.Wallet(txSignerKey, provider);
  const attestationSigner = new ethers.Wallet(attestationSignerKey);
  const processor = new DepositScreenerProcessor(
    adapter,
    depositManagerAddress,
    attestationSigner,
    txSigner,
    await getRedis()
  );

  const { promise, teardown } = await processor.start();
  return async () => {
    await teardown();
    await promise;
    await clearRedis();
  };
}