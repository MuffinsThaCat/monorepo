import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";
import {
  makeLogger,
  getEthersProviderFromEnv,
  getTxSubmitterFromEnv,
} from "@nocturne-xyz/offchain-utils";
import { Command } from "commander";
import { ethers } from "ethers";
import { DepositScreenerFulfiller } from "../../../fulfiller";
import { DepositScreenerScreener } from "../../../screener";
import {
  ConcreteScreeningChecker,
  DummyScreeningApi,
  ScreeningCheckerApi,
} from "../../../screening";
import { SubgraphDepositEventSyncAdapter } from "@nocturne-xyz/subgraph-sync-adapters";
import { getRedis } from "./utils";

const runProcess = new Command("processor")
  .summary("process deposit requests")
  .description(
    "must supply the following environment variables: ENVIRONMENT, REDIS_URL, REDIS_PASSWORD, RPC_URL, and SUBGRAPH_URL. must supply config-name-or-path as option"
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "deposit manager contract address"
  )
  .option(
    "--dummy-screening-delay <number>",
    "dummy screening delay in seconds (test purposes only)"
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to. if not given, logs will only be emitted to stdout."
  )
  .option(
    "--throttle-ms <number>",
    "maximum period of time to wait before pulling new deposit events",
    parseInt
  )
  .option(
    "--finality-blocks <number>",
    "number of confirmations to wait before processing new deposit requests",
    parseInt
  )
  .option("--skip-undergassed-deposits <boolean>", "skip undergassed deposits")
  .option("--log-level <string>", "min log importance to log to stdout.")
  .action(async (options) => {
    const env = process.env.ENVIRONMENT;
    if (!env) {
      throw new Error("ENVIRONMENT env var not set");
    }
    if (env !== "production" && env !== "development" && env !== "local") {
      throw new Error(`ENVIRONMENT env var set to invalid value: ${env}`);
    }

    const {
      configNameOrPath,
      logDir,
      throttleMs,
      logLevel,
      skipUndergassedDeposits,
    } = options;

    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      configName,
      "deposit-screener",
      "processor",
      logLevel,
      logDir
    );

    const config = loadNocturneConfig(configNameOrPath);
    logger.info("config", { config });

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUBGRAPH_URL;
    if (!subgraphEndpoint) {
      throw new Error("missing SUBGRAPH_URL");
    }
    const adapter = new SubgraphDepositEventSyncAdapter(
      subgraphEndpoint,
      logger.child({ function: "SubgraphDepositEventSyncAdapter" })
    );

    const provider = getEthersProviderFromEnv();
    const txSubmitter = getTxSubmitterFromEnv();

    const attestationSignerKey = process.env.ATTESTATION_SIGNER_KEY;
    if (!attestationSignerKey) {
      throw new Error("missing ATTESTATION_SIGNER_KEY");
    }
    const attestationSigner = new ethers.Wallet(attestationSignerKey);

    const supportedAssets = new Set(
      Array.from(config.erc20s.values()).map(({ address }) => address)
    );

    const redis = getRedis();

    let screeningApi: ScreeningCheckerApi;
    if (env === "local" || env == "development") {
      logger.info("Configuring dummy screening api");
      const { dummyScreeningDelay } = options;
      screeningApi = new DummyScreeningApi(dummyScreeningDelay);
    } else {
      logger.info("Configuring real screening api");
      screeningApi = new ConcreteScreeningChecker(redis, logger);
    }

    const screener = new DepositScreenerScreener(
      adapter,
      config.depositManagerAddress,
      provider,
      redis,
      logger,
      screeningApi,
      supportedAssets,
      {
        startBlock: config.contracts.startBlock,
        skipUndergassedDeposits,
      }
    );

    const finalityBlocks =
      options.finalityBlocks ?? config.offchain.finalityBlocks;

    const fulfiller = new DepositScreenerFulfiller(
      logger,
      config.depositManagerAddress,
      provider,
      txSubmitter,
      attestationSigner,
      getRedis(),
      supportedAssets,
      finalityBlocks
    );

    const screenerHandle = await screener.start({
      throttleMs,
      finalityBlocks,
    });
    const fulfillerHandle = await fulfiller.start();

    await Promise.all([screenerHandle.promise, fulfillerHandle.promise]);
  });

export default runProcess;
