import { ethers } from "ethers";
import * as fs from "fs";
import {
  Wallet__factory,
  Handler__factory,
  Handler,
  Wallet,
  DepositManager,
  DepositManager__factory,
} from "@nocturne-xyz/contracts";

import {
  NocturneSigner,
  NocturneWalletSDK,
  InMemoryKVStore,
  NocturneDB,
  SparseMerkleProver,
  JoinSplitProver,
  RPCSDKSyncAdapter,
  SDKSyncAdapter,
  SubgraphSDKSyncAdapter,
  Address,
  sleep,
  thunk,
} from "@nocturne-xyz/sdk";

import {
  checkNocturneContractDeployment,
  deployNocturne,
} from "@nocturne-xyz/deploy";

import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import { WasmJoinSplitProver } from "@nocturne-xyz/local-prover";
import {
  NocturneConfig,
  NocturneContractDeployment,
} from "@nocturne-xyz/config";
import { AnvilNetworkConfig, startAnvil } from "./anvil";
import { BundlerConfig, startBundler } from "./bundler";
import { DepositScreenerConfig, startDepositScreener } from "./screener";
import { startSubtreeUpdater, SubtreeUpdaterConfig } from "./subtreeUpdater";
import { startSubgraph, SubgraphConfig } from "./subgraph";
import { KEYS_TO_WALLETS } from "./keys";

// eslint-disable-next-line
const ROOT_DIR = findWorkspaceRoot()!;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_js/joinsplit.wasm`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/joinsplit.zkey`;
const VKEY_PATH = `${ARTIFACTS_DIR}/joinsplit/joinsplit_cpp/vkey.json`;
const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());

export interface NocturneDeployArgs {
  screeners: Address[];
  subtreeBatchFillers: Address[];
}

export interface TestActorsConfig {
  // specify which actors to include
  // if not given, all actors are deployed
  include: {
    bundler?: boolean;
    depositScreener?: boolean;
    subtreeUpdater?: boolean;
    subgraph?: boolean;
  };

  // specify configs for actors to deploy
  // if non-skipped actors don't have a config, one of the defaults below will be used
  configs?: {
    bundler?: Partial<BundlerConfig>;
    depositScreener?: Partial<DepositScreenerConfig>;
    subtreeUpdater?: Partial<SubtreeUpdaterConfig>;
    subgraph?: Partial<SubgraphConfig>;
  };
}

export interface NocturneTestDeployment {
  depositManager: DepositManager;
  wallet: Wallet;
  handler: Handler;
  contractDeployment: NocturneContractDeployment;
  provider: ethers.providers.JsonRpcProvider;
  deployerEoa: ethers.Wallet;
  aliceEoa: ethers.Wallet;
  bobEoa: ethers.Wallet;
  bundlerEoa: ethers.Wallet;
  subtreeUpdaterEoa: ethers.Wallet;
  screenerEoa: ethers.Wallet;
  teardown: () => Promise<void>;
}

// defaults for actor deployments
const ANVIL_URL = "http://0.0.0.0:8545";
export const SUBGRAPH_URL =
  "http://localhost:8000/subgraphs/name/nocturne-test";

const DEFAULT_ANVIL_CONFIG: AnvilNetworkConfig = {
  blockTimeSecs: 1,
};

const DEFAULT_BUNDLER_CONFIG: Omit<
  BundlerConfig,
  "walletAddress" | "txSignerKey" | "ignoreGas"
> = {
  maxLatency: 1,
  rpcUrl: ANVIL_URL,
};

const DEFAULT_DEPOSIT_SCREENER_CONFIG: Omit<
  DepositScreenerConfig,
  "depositManagerAddress" | "txSignerKey" | "attestationSignerKey"
> = {
  rpcUrl: ANVIL_URL,
  subgraphUrl: SUBGRAPH_URL,
};

const DEFAULT_SUBTREE_UPDATER_CONFIG: Omit<
  SubtreeUpdaterConfig,
  "handlerAddress" | "txSignerKey"
> = {
  rpcUrl: ANVIL_URL,
};

const DEFAULT_SUBGRAPH_CONFIG: Omit<SubgraphConfig, "walletAddress"> = {
  startBlock: 0,
};

// we want to only start anvil once, so we wrap `startAnvil` in a thunk
const anvilThunk = thunk(() => startAnvil(DEFAULT_ANVIL_CONFIG));

// returns an async function that should be called for teardown
// if include is not given, no off-chain actors will be deployed
export async function setupTestDeployment(
  config: TestActorsConfig
): Promise<NocturneTestDeployment> {
  // anvil has to go up first,
  // then contracts,
  // then everything else can go up in any order

  const startTime = Date.now();

  // spin up anvil
  console.log("starting anvil...");
  const resetAnvil = await anvilThunk();

  // deploy contracts
  const provider = new ethers.providers.JsonRpcProvider(ANVIL_URL);
  console.log("enabling automine...");
  await provider.send("evm_setAutomine", [true]);

  const [
    deployerEoa,
    aliceEoa,
    bobEoa,
    bundlerEoa,
    subtreeUpdaterEoa,
    screenerEoa,
  ] = KEYS_TO_WALLETS(provider);
  console.log("deploying contracts...");
  const contractDeployment = await deployContractsWithDummyAdmins(deployerEoa, {
    screeners: [screenerEoa.address],
    subtreeBatchFillers: [deployerEoa.address, subtreeUpdaterEoa.address],
  });

  await checkNocturneContractDeployment(
    contractDeployment,
    deployerEoa.provider
  );

  const { depositManagerProxy, walletProxy, handlerProxy } = contractDeployment;
  const [depositManager, wallet, handler] = await Promise.all([
    DepositManager__factory.connect(depositManagerProxy.proxy, deployerEoa),
    Wallet__factory.connect(walletProxy.proxy, deployerEoa),
    Handler__factory.connect(handlerProxy.proxy, deployerEoa),
  ]);

  // Deploy subgraph first, as other services depend on it
  let stopSubgraph: undefined | (() => Promise<void>);
  if (config.include.subgraph) {
    const givenSubgraphConfig = config.configs?.subgraph ?? {};
    const subgraphConfig = {
      ...DEFAULT_SUBGRAPH_CONFIG,
      ...givenSubgraphConfig,
      walletAddress: walletProxy.proxy,
    };

    stopSubgraph = await startSubgraph(subgraphConfig);
    await sleep(5_000); // wait for subgraph to start up (TODO: better way to do this?)
  }

  // deploy everything else
  const proms = [];
  if (config.include.bundler) {
    const givenBundlerConfig = config.configs?.bundler ?? {};
    const bundlerConfig: BundlerConfig = {
      ...DEFAULT_BUNDLER_CONFIG,
      ...givenBundlerConfig,
      walletAddress: walletProxy.proxy,
      txSignerKey: bundlerEoa.privateKey,
    };

    proms.push(startBundler(bundlerConfig));
  }

  // deploy subtree updater if requested
  if (config.include.subtreeUpdater) {
    const givenSubtreeUpdaterConfig = config.configs?.subtreeUpdater ?? {};
    const subtreeUpdaterConfig: SubtreeUpdaterConfig = {
      ...DEFAULT_SUBTREE_UPDATER_CONFIG,
      ...givenSubtreeUpdaterConfig,
      handlerAddress: handlerProxy.proxy,
      txSignerKey: subtreeUpdaterEoa.privateKey,
    };

    proms.push(startSubtreeUpdater(subtreeUpdaterConfig));
  }

  if (config.include.depositScreener) {
    const givenDepositScreenerConfig = config.configs?.depositScreener ?? {};
    const depositScreenerConfig: DepositScreenerConfig = {
      ...DEFAULT_DEPOSIT_SCREENER_CONFIG,
      ...givenDepositScreenerConfig,
      depositManagerAddress: depositManagerProxy.proxy,
      attestationSignerKey: screenerEoa.privateKey,
      txSignerKey: screenerEoa.privateKey,
    };

    proms.push(startDepositScreener(depositScreenerConfig));
  }

  const actorTeardownFns = await Promise.all(proms);
  // wait for them all to start up
  await sleep(3_000);

  const teardown = async () => {
    console.log("tearing down offchain actors...");
    // teardown offchain actors
    await Promise.all(actorTeardownFns.map((fn) => fn()));

    // wait for actors to teardown
    await sleep(3_000);

    // teradown subgraph
    if (stopSubgraph) {
      console.log("tearing down subgraph...");
      await stopSubgraph();
      // wait for subgraph to tear down
      await sleep(10_000);
    }

    console.log("resetting anvil...");
    // reset anvil node
    await resetAnvil();
    // wait for anvil to reset
    await sleep(1_000);
  };

  console.log(`setupTestDeployment took ${Date.now() - startTime}ms.`);
  console.log("disabling automine...");
  await provider.send("evm_setAutomine", [false]);
  // need to turn interval mining back on, as `setAutomine true` turns off
  await provider.send("evm_setIntervalMining", [
    DEFAULT_ANVIL_CONFIG.blockTimeSecs,
  ]);

  return {
    depositManager,
    wallet,
    handler,
    contractDeployment,
    provider,
    teardown,
    deployerEoa,
    aliceEoa,
    bobEoa,
    bundlerEoa,
    subtreeUpdaterEoa,
    screenerEoa,
  };
}

export async function deployContractsWithDummyAdmins(
  connectedSigner: ethers.Wallet,
  args: NocturneDeployArgs
): Promise<NocturneContractDeployment> {
  const deployment = await deployNocturne(
    connectedSigner,
    {
      proxyAdminOwner: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
      walletOwner: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
      handlerOwner: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
      depositManagerOwner: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
      screeners: args.screeners,
      subtreeBatchFillers: args.subtreeBatchFillers,
    },
    {
      useMockSubtreeUpdateVerifier:
        process.env.ACTUALLY_PROVE_SUBTREE_UPDATE == undefined,
      confirmations: 1,
    }
  );

  // Log for dev site script
  console.log("Wallet address:", deployment.walletProxy.proxy);
  console.log("Handler address:", deployment.handlerProxy.proxy);
  console.log("DepositManager address:", deployment.depositManagerProxy.proxy);
  return deployment;
}

export interface SetupNocturneOpts {
  syncAdapter?: SyncAdapterOption;
  gasAssets?: Map<string, string>;
}

export enum SyncAdapterOption {
  RPC,
  SUBGRAPH,
}

export interface NocturneClientSetup {
  nocturneDBAlice: NocturneDB;
  nocturneWalletSDKAlice: NocturneWalletSDK;
  nocturneDBBob: NocturneDB;
  nocturneWalletSDKBob: NocturneWalletSDK;
  joinSplitProver: JoinSplitProver;
}

export async function setupTestClient(
  contractDeployment: NocturneContractDeployment,
  provider: ethers.providers.Provider,
  opts?: SetupNocturneOpts
): Promise<NocturneClientSetup> {
  const config = new NocturneConfig(
    contractDeployment,
    // TODO: fill with real assets and rate limits in SDK gas asset and deposit
    // screener PRs
    opts?.gasAssets ?? new Map(Object.entries({})),
    new Map(Object.entries({}))
  );

  const { handlerProxy } = contractDeployment;

  let syncAdapter: SDKSyncAdapter;
  if (opts?.syncAdapter && opts.syncAdapter === SyncAdapterOption.SUBGRAPH) {
    syncAdapter = new SubgraphSDKSyncAdapter(SUBGRAPH_URL);
  } else {
    syncAdapter = new RPCSDKSyncAdapter(provider, handlerProxy.proxy);
  }

  console.log("Create NocturneWalletSDKAlice");
  const aliceKV = new InMemoryKVStore();
  const nocturneDBAlice = new NocturneDB(aliceKV);
  const merkleProverAlice = new SparseMerkleProver(aliceKV);
  const nocturneWalletSDKAlice = setupNocturneWalletSDK(
    3n,
    config,
    provider,
    nocturneDBAlice,
    merkleProverAlice,
    syncAdapter
  );

  console.log("Create NocturneWalletSDKBob");
  const bobKV = new InMemoryKVStore();
  const nocturneDBBob = new NocturneDB(bobKV);
  const merkleProverBob = new SparseMerkleProver(aliceKV);
  const nocturneWalletSDKBob = setupNocturneWalletSDK(
    5n,
    config,
    provider,
    nocturneDBBob,
    merkleProverBob,
    syncAdapter
  );

  const joinSplitProver = new WasmJoinSplitProver(WASM_PATH, ZKEY_PATH, VKEY);

  return {
    nocturneDBAlice,
    nocturneWalletSDKAlice,
    nocturneDBBob,
    nocturneWalletSDKBob,
    joinSplitProver,
  };
}

function setupNocturneWalletSDK(
  sk: bigint,
  config: NocturneConfig,
  provider: ethers.providers.Provider,
  nocturneDB: NocturneDB,
  merkleProver: SparseMerkleProver,
  syncAdapter: SDKSyncAdapter
): NocturneWalletSDK {
  const nocturneSigner = new NocturneSigner(sk);

  return new NocturneWalletSDK(
    nocturneSigner,
    provider,
    config,
    merkleProver,
    nocturneDB,
    syncAdapter
  );
}
