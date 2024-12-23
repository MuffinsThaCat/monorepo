import {
  SubtreeUpdater,
  RapidsnarkSubtreeUpdateProver,
} from "@nocturne-xyz/subtree-updater";
import { MockSubtreeUpdateProver, thunk } from "@nocturne-xyz/core";
import { ethers } from "ethers";
import {
  EthersTxSubmitter,
  makeTestLogger,
} from "@nocturne-xyz/offchain-utils";
import { Handler__factory } from "@nocturne-xyz/contracts";
import { makeRedisInstance } from "./utils";
import findWorkspaceRoot from "find-yarn-workspace-root";
import path from "path";

const ROOT_DIR = findWorkspaceRoot()!;
const TMP_DIR = `${ROOT_DIR}/rapidsnark--tmp`;
const RADISNARK_EXECUTABLE_PATH = `${ROOT_DIR}/rapidsnark/build/prover`;

const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WITNESS_GENERATOR_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;

export interface SubtreeUpdaterConfig {
  handlerAddress: string;
  rpcUrl: string;
  subgraphUrl: string;
  txSignerKey: string;
  fillBatchLatency?: number;
  useRapidsnark?: boolean;
}

const { getRedis, clearRedis, getRedisServer } = makeRedisInstance();

export const getInsertionLogRedisServer = thunk(async () => {
  return await getRedisServer();
});

export async function startSubtreeUpdater(
  config: SubtreeUpdaterConfig
): Promise<() => Promise<void>> {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  const txSubmitter = new EthersTxSubmitter(
    new ethers.Wallet(config.txSignerKey, provider)
  );
  const logger = makeTestLogger("subtree-updater", "subtree-updater");
  const handlerContract = Handler__factory.connect(
    config.handlerAddress,
    provider
  );
  const prover = config.useRapidsnark
    ? new RapidsnarkSubtreeUpdateProver(
        RADISNARK_EXECUTABLE_PATH,
        WITNESS_GENERATOR_PATH,
        ZKEY_PATH,
        VKEY_PATH,
        TMP_DIR
      )
    : new MockSubtreeUpdateProver();
  const updater = new SubtreeUpdater(
    handlerContract,
    txSubmitter,
    logger,
    await getRedis(),
    prover,
    config.subgraphUrl,
    {
      fillBatchLatency: config.fillBatchLatency,
    }
  );

  const { promise, teardown } = await updater.start();

  return async () => {
    await teardown();
    await promise;
    await clearRedis();
  };
}
