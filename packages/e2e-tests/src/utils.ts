import {
  DepositStatusResponse,
  IncludedEncryptedNote,
  IncludedNote,
  MockSubtreeUpdateProver,
  NoteTrait,
  OperationStatus,
  SubmittableOperationWithNetworkInfo,
  SubtreeUpdateProver,
  TreeConstants,
  OperationTrait,
  range,
} from "@nocturne-xyz/core";
import { Mutex } from "async-mutex";
import { spawn } from "child_process";
import { RapidsnarkSubtreeUpdateProver } from "@nocturne-xyz/subtree-updater";
import findWorkspaceRoot from "find-yarn-workspace-root";
import * as path from "path";
import * as fs from "fs";
import * as JSON from "bigint-json-serialization";
import { WasmSubtreeUpdateProver } from "@nocturne-xyz/local-prover";
import IORedis from "ioredis";
import { RedisMemoryServer } from "redis-memory-server";
import { thunk } from "@nocturne-xyz/core";
import { Insertion } from "@nocturne-xyz/persistent-log";
import { fetchTreeInsertions } from "@nocturne-xyz/subgraph-sync-adapters/src/treeInsertions/fetch";
import { SUBGRAPH_URL } from "./deploy";

const ROOT_DIR = findWorkspaceRoot()!;
const EXECUTABLE_CMD = `${ROOT_DIR}/rapidsnark/build/prover`;
const ARTIFACTS_DIR = path.join(ROOT_DIR, "circuit-artifacts");
const WASM_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_js/subtreeupdate.wasm`;
const WITNESS_GEN_EXECUTABLE_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate`;
const ZKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/subtreeupdate.zkey`;
const TMP_PATH = `${ARTIFACTS_DIR}/subtreeupdate/`;
const VKEY_PATH = `${ARTIFACTS_DIR}/subtreeupdate/subtreeupdate_cpp/vkey.json`;

const MOCK_SUBTREE_UPDATER_DELAY = 2100;

export const ONE_DAY_SECONDS = 60n * 60n * 24n;

// 10^9 (e.g. 10 gwei if this was eth)
export const GAS_PRICE = 10n * 10n ** 9n;
// 10^9 gas
export const GAS_FAUCET_DEFAULT_AMOUNT = 10_000_000n * GAS_PRICE; // 100M gwei

export const BUNDLER_ENDPOINT = `http://localhost:3000`;

export type TeardownFn = () => Promise<void>;
export type ResetFn = () => Promise<void>;

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getSubtreeUpdateProver(): SubtreeUpdateProver {
  if (
    process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true" &&
    process.env.USE_RAPIDSNARK === "true"
  ) {
    return new RapidsnarkSubtreeUpdateProver(
      EXECUTABLE_CMD,
      WITNESS_GEN_EXECUTABLE_PATH,
      ZKEY_PATH,
      VKEY_PATH,
      TMP_PATH
    );
  } else if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    const VKEY = JSON.parse(fs.readFileSync(VKEY_PATH).toString());
    return new WasmSubtreeUpdateProver(WASM_PATH, ZKEY_PATH, VKEY);
  }

  return new MockSubtreeUpdateProver();
}

export function getSubtreeUpdaterDelay(): number {
  if (
    process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true" &&
    process.env.USE_RAPIDSNARK === "true"
  ) {
    return MOCK_SUBTREE_UPDATER_DELAY + 8000;
  } else if (process.env.ACTUALLY_PROVE_SUBTREE_UPDATE === "true") {
    return MOCK_SUBTREE_UPDATER_DELAY + 60000;
  }

  return MOCK_SUBTREE_UPDATER_DELAY;
}

export async function queryDepositStatus(
  depositHash: string
): Promise<DepositStatusResponse | undefined> {
  console.log(`query deposit status for ${depositHash}`);

  try {
    const res = await fetch(`http://localhost:3001/status/${depositHash}`, {
      method: "GET",
    });
    return (await res.json()) as DepositStatusResponse;
  } catch (err) {
    console.error("error getting deposit status: ", err);
  }
}

export async function checkBundlerHasNf(nf: bigint): Promise<boolean> {
  console.log(`checking bundler has nullifier ${nf}`);

  try {
    const res = await fetch(`${BUNDLER_ENDPOINT}/nullifiers/${nf}`, {
      method: "GET",
    });
    const resJson = await res.json();
    return resJson.exists;
  } catch (err) {
    console.error("error checking nullifier: ", err);
    return false;
  }
}

export async function submitAndProcessOperation(
  operation: SubmittableOperationWithNetworkInfo
): Promise<OperationStatus> {
  console.log("submitting operation");
  let res: any;
  try {
    res = await fetch(`${BUNDLER_ENDPOINT}/relay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ operation }),
    });
    const resJson = await res.json();
    console.log("bundler server response: ", resJson);

    if (!res.ok) {
      throw new Error(resJson);
    }
  } catch (err) {
    console.log("error submitting operation: ", err);
    throw err;
  }

  console.log("waiting for bundler to receive the operation");
  await sleep(5_000);

  const operationDigest = OperationTrait.computeDigest(operation);

  let count = 0;
  while (count < 10) {
    try {
      res = await fetch(`${BUNDLER_ENDPOINT}/operations/${operationDigest}`, {
        method: "GET",
      });
      const statusRes = await res.json();
      const status = statusRes.status as OperationStatus;
      console.log(`bundler marked operation ${operationDigest} ${status}`);

      if (
        status === OperationStatus.EXECUTED_SUCCESS ||
        status === OperationStatus.OPERATION_PROCESSING_FAILED ||
        status === OperationStatus.OPERATION_EXECUTION_FAILED ||
        status === OperationStatus.OPERATION_VALIDATION_FAILED ||
        status === OperationStatus.BUNDLE_REVERTED
      ) {
        return status;
      }
    } catch (err) {
      console.log("error getting operation status: ", err);
      throw err;
    }

    await sleep(5_000);
    count++;
  }

  // if we get here, operation timed out
  console.error("operation timed out after 50 seconds");
  throw new Error("operation timed out after 50 seconds");
}

export async function runCommand(
  cmd: string,
  cwd?: string
): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn("sh", ["-c", cmd], { cwd, env: process.env });
    child.stdout.on("data", (data) => {
      const output = data.toString();
      stdout += output;
    });
    child.stderr.on("data", (data) => {
      const output = data.toString();
      stderr += output;
    });
    child.on("error", () => {
      console.error(stderr);
      reject(stderr);
    });
    child.on("exit", () => {
      console.log(stdout);
      resolve([stdout, stderr]);
    });

    // kill child if parent exits first
    process.on("exit", () => {
      child.kill();
    });
  });
}

export interface RunCommandDetachedOpts {
  cwd?: string;
  processName?: string;
  onStdOut?: (data: string) => void;
  onStdErr?: (data: string) => void;
  onError?: (stderr: string) => void;
  onExit?: (
    stdout: string,
    stderr: string,
    code: number | null,
    signal: NodeJS.Signals | null
  ) => void;
}

export function runCommandBackground(
  cmd: string,
  args: string[],
  opts?: RunCommandDetachedOpts
) {
  const { cwd, onStdOut, onStdErr, onError, onExit, processName } = opts ?? {};
  const child = spawn(cmd, args, { cwd });

  // Define the log file path
  const logFilePath = path.join(cwd || ".", "hardhat.log");

  // Create a write stream for the log file
  const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (data) => {
    const output = data.toString();
    stdout += output;
    logStream.write(output); // Write to log file

    if (onStdOut) {
      onStdOut(output);
    }
  });

  child.stderr.on("data", (data) => {
    const output = data.toString();
    stderr += output;
    logStream.write(output); // Write to log file

    if (onStdErr) {
      onStdErr(output);
    }
  });

  child.on("error", () => {
    if (onError) {
      onError(stderr);
    } else {
      console.error(stderr);
    }
  });

  child.on("close", (code: number | null, signal: NodeJS.Signals | null) => {
    let msg = "";
    if (processName) {
      msg += `${processName} (${child.pid}) exited`;
    } else {
      msg += `child process ${child.pid} exited`;
    }

    if (code) {
      msg += ` with code ${code}`;
    }
    if (signal) {
      msg += ` on signal ${signal}`;
    }

    logStream.write(`${msg}\n`); // Write exit message to log file
    logStream.end(); // Close the stream

    if (onExit) {
      onExit(stdout, stderr, code, signal);
    } else {
      console.log(msg);
      if (stderr) {
        console.log("STDERR:");
        console.log(stderr);
      }
    }
  });

  // kill child if parent exits first
  process.on("exit", () => {
    child.kill();
  });

  return child;
}

interface RedisHandle {
  getRedisServer: () => Promise<RedisMemoryServer>;
  getRedis: () => Promise<IORedis>;
  clearRedis: () => Promise<void>;
}

// HACK specify ports to use up-front to ensure they don't conflict with any of the actors
const redisPorts = range(6000, 6100);
const mutex = new Mutex();
export function makeRedisInstance(): RedisHandle {
  const redisThunk = thunk<[IORedis, RedisMemoryServer]>(async () => {
    const port = await mutex.runExclusive(() => redisPorts.pop());
    if (!port)
      throw new Error("ran out of available ports for redis instances");

    const server = await RedisMemoryServer.create({ instance: { port } });
    const host = await server.getHost();
    return [new IORedis(port, host), server];
  });

  return {
    getRedisServer: async () => (await redisThunk())[1],
    getRedis: async () => (await redisThunk())[0],
    clearRedis: async () => {
      const [redis, _] = await redisThunk();
      redis.flushall();
    },
  };
}

export async function getAllTreeInsertionsFromSubgraph(): Promise<Insertion[]> {
  const treeInsertionEvents = await fetchTreeInsertions(SUBGRAPH_URL, 0n);
  return treeInsertionEvents.flatMap(({ inner: insertion }): Insertion[] => {
    if ("numZeros" in insertion) {
      return range(insertion.numZeros).map((i) => ({
        merkleIndex: insertion.merkleIndex + i,
        noteCommitment: TreeConstants.ZERO_VALUE,
      }));
    } else if (NoteTrait.isEncryptedNote(insertion)) {
      const noteCommitment = (insertion as IncludedEncryptedNote).commitment;
      return [
        {
          merkleIndex: insertion.merkleIndex,
          noteCommitment,
        },
      ];
    } else {
      return [insertion as IncludedNote];
    }
  });
}
