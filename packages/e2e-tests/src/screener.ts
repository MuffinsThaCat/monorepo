import { Erc20Config } from "@nocturne-xyz/config";
import { Address } from "@nocturne-xyz/core";
import {
  DepositScreenerFulfiller,
  DepositScreenerScreener,
  DepositScreenerServer,
  DummyScreeningApi,
} from "@nocturne-xyz/deposit-screener";
import { SubgraphDepositEventSyncAdapter } from "@nocturne-xyz/subgraph-sync-adapters";
import {
  EthersTxSubmitter,
  createPool,
  makeTestLogger,
} from "@nocturne-xyz/offchain-utils";
import { ethers } from "ethers";
import IORedis from "ioredis";
import { TeardownFn, makeRedisInstance } from "./utils";
import { Knex } from "knex";

export interface DepositScreenerConfig {
  depositManagerAddress: string;
  subgraphUrl: string;
  rpcUrl: string;
  attestationSignerKey: string;
  txSignerKey: string;
  dummyScreeningDelaySeconds?: number;
}

const { getRedis, clearRedis } = makeRedisInstance();

export async function startDepositScreener(
  config: DepositScreenerConfig,
  supportedAssets: Map<string, Erc20Config>
): Promise<TeardownFn> {
  const redis = await getRedis();
  const pool = createPool();

  const supportedAssetsSet = new Set(
    Array.from(supportedAssets.values()).map((config) => config.address)
  );
  const supportedAssetRateLimits = new Map(
    Array.from(supportedAssets.values()).map((config) => [
      config.address,
      BigInt(config.globalCapWholeTokens) * 10n ** BigInt(config.precision),
    ])
  );

  const stopProcessor = await startDepositScreenerScreener(
    config,
    redis,
    supportedAssetsSet
  );
  const stopFulfiller = await startDepositScreenerFulfiller(
    config,
    redis,
    supportedAssetsSet
  );
  const stopServer = startDepositScreenerServer(
    config,
    redis,
    pool,
    supportedAssetRateLimits
  );

  return async () => {
    await stopProcessor();
    await stopFulfiller();
    await stopServer();
    await clearRedis();
  };
}

async function startDepositScreenerScreener(
  config: DepositScreenerConfig,
  redis: IORedis,
  supportedAssets: Set<Address>
): Promise<TeardownFn> {
  const { depositManagerAddress, subgraphUrl, rpcUrl } = config;

  const logger = makeTestLogger("deposit-screener", "processor");
  const adapter = new SubgraphDepositEventSyncAdapter(subgraphUrl, logger);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const screener = new DepositScreenerScreener(
    adapter,
    depositManagerAddress,
    provider,
    redis,
    logger,
    new DummyScreeningApi(config.dummyScreeningDelaySeconds ?? 5),
    supportedAssets
  );

  const { promise, teardown } = await screener.start();
  return async () => {
    await teardown();
    await promise;
  };
}

async function startDepositScreenerFulfiller(
  config: DepositScreenerConfig,
  redis: IORedis,
  supportedAssets: Set<Address>
): Promise<TeardownFn> {
  const { depositManagerAddress, rpcUrl, attestationSignerKey, txSignerKey } =
    config;

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const txSubmitter = new EthersTxSubmitter(
    new ethers.Wallet(txSignerKey, provider)
  );
  const attestationSigner = new ethers.Wallet(attestationSignerKey);

  const logger = makeTestLogger("deposit-screener", "fulfiller");

  const fulfiller = new DepositScreenerFulfiller(
    logger,
    depositManagerAddress,
    provider,
    txSubmitter,
    attestationSigner,
    redis,
    supportedAssets
  );

  const { promise, teardown } = await fulfiller.start();

  return async () => {
    await teardown();
    await promise;
  };
}

function startDepositScreenerServer(
  config: DepositScreenerConfig,
  redis: IORedis,
  pool: Knex,
  supportedAssetRateLimits: Map<Address, bigint>
): TeardownFn {
  const logger = makeTestLogger("deposit-screener", "server");

  const server = new DepositScreenerServer(
    logger,
    redis,
    pool,
    new DummyScreeningApi(config.dummyScreeningDelaySeconds ?? 5),
    supportedAssetRateLimits
  );

  const { teardown } = server.start(3001);
  return teardown;
}
