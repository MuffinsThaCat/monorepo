import { Command } from "commander";
import { ethers } from "ethers";
import { SubtreeUpdater } from "../../../subtreeUpdater";
import { SubgraphSubtreeUpdaterSyncAdapter } from "../../../sync/subgraph/adapter";
import { getRedis } from "../utils";
import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { extractConfigName, loadNocturneConfig } from "@nocturne-xyz/config";
import { Handler__factory } from "@nocturne-xyz/contracts";
import {
  MockSubtreeUpdateProver,
  SubtreeUpdateProver,
  assertOrErr,
} from "@nocturne-xyz/core";
import { RapidsnarkSubtreeUpdateProver } from "../../../rapidsnarkProver";
import {
  DefenderRelayProvider,
  DefenderRelaySigner,
} from "@openzeppelin/defender-relay-client/lib/ethers";

export const runSubtreeUpdater = new Command("subtree-updater")
  .summary("run subtree updater service")
  .description(
    "must supply .env file with REDIS_URL, RPC_URL, TX_SIGNER_KEY, and SUBGRAPH_URL"
  )
  .requiredOption(
    "--config-name-or-path <string>",
    "deposit manager contract address"
  )
  .option(
    "--use-mock-prover",
    "use mock prover to generate proofs instead of rapidsnark. If false, must supply --rapidsnark-executable-path, --witness-generator-path, --zkey-path, and --vkey-path.",
    false
  )
  .option(
    "--rapidsnark-executable-path <string>",
    "path to rapidsnark executable"
  )
  .option("--witness-generator-path <string>", "path to witness generator")
  .option("--zkey-path <string>", "path to zkey")
  .option("--vkey-path <string>", "path to vkey")
  .option(
    "--tmp-dir <string>",
    "optional path to use for witness / proof files for rapdisnark"
  )
  .option(
    "--fill-batch-latency-ms <number>",
    "maximum period of time to wait before force-filling a batch with zeros on-chain",
    parseInt
  )
  .option(
    "--throttle-ms <number>",
    "maximum period of time to wait before pulling new insertions",
    parseInt
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to",
    "./logs/subtree-updater"
  )
  .option(
    "--stdout-log-level <string>",
    "min log importance to log to stdout. if not given, logs will not be emitted to stdout"
  )
  .action(async (options) => {
    const {
      configNameOrPath,
      logDir,
      throttleMs,
      useMockProver,
      fillBatchLatencyMs,
      rapidsnarkExecutablePath,
      witnessGeneratorPath,
      zkeyPath,
      vkeyPath,
      stdoutLogLevel,
    } = options;

    const configName = extractConfigName(configNameOrPath);
    const logger = makeLogger(
      logDir,
      `${configName}-subtree-updater`,
      "subtree-updater",
      stdoutLogLevel
    );

    const config = loadNocturneConfig(configNameOrPath);
    logger.info("config", { config });

    // TODO: enable switching on adapter impl
    const subgraphEndpoint = process.env.SUBGRAPH_URL;
    if (!subgraphEndpoint) {
      throw new Error("missing SUBGRAPH_URL");
    }
    const adapter = new SubgraphSubtreeUpdaterSyncAdapter(
      subgraphEndpoint,
      logger.child({ function: "SubgraphSubtreeUpdaterSyncAdapter" })
    );

    const relayerApiKey = process.env.OZ_RELAYER_API_KEY;
    const relayerApiSecret = process.env.OZ_RELAYER_API_SECRET;

    const privateKey = process.env.TX_SIGNER_KEY;
    const rpcUrl = process.env.RPC_URL;

    let signer: ethers.Signer;
    if (relayerApiKey && relayerApiSecret) {
      const credentials = {
        apiKey: relayerApiKey,
        apiSecret: relayerApiSecret,
      };
      const provider = new DefenderRelayProvider(credentials);
      signer = new DefenderRelaySigner(credentials, provider, {
        speed: "average",
      });
    } else if (rpcUrl && privateKey) {
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      signer = new ethers.Wallet(privateKey, provider);
    } else {
      throw new Error(
        "missing RPC_URL/PRIVATE_KEY or OZ_RELAYER_API_KEY/OZ_RELAYER_API_SECRET"
      );
    }

    const handlerContract = Handler__factory.connect(
      config.handlerAddress(),
      signer
    );

    const fillBatchLatency = fillBatchLatencyMs
      ? (fillBatchLatencyMs as number)
      : undefined;

    let prover: SubtreeUpdateProver;
    if (useMockProver) {
      logger.info("using mock prover");
      prover = new MockSubtreeUpdateProver();
    } else {
      logger.info("using rapidsnark prover");
      assertOrErr(
        rapidsnarkExecutablePath,
        "rapidsnark executable path must be specified when not using mock prover"
      );
      assertOrErr(
        witnessGeneratorPath,
        "witness generator path must be specified when not using mock prover"
      );
      assertOrErr(
        zkeyPath,
        "zkey path must be specified when not using mock prover"
      );
      assertOrErr(
        vkeyPath,
        "vkey path must be specified when not using mock prover"
      );

      prover = new RapidsnarkSubtreeUpdateProver(
        rapidsnarkExecutablePath,
        witnessGeneratorPath,
        zkeyPath,
        vkeyPath
      );
    }

    const updater = new SubtreeUpdater(
      handlerContract,
      adapter,
      logger,
      getRedis(),
      prover,
      { fillBatchLatency }
    );

    const { promise } = await updater.start(throttleMs);
    await promise;
  });