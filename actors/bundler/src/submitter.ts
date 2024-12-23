import {
  Handler,
  Handler__factory,
  Teller,
  Teller__factory,
} from "@nocturne-xyz/contracts";
import {
  Address,
  OperationStatus,
  OperationTrait,
  SubmittableOperationWithNetworkInfo,
  maxGasForOperation,
  parseEventsFromTransactionReceipt,
} from "@nocturne-xyz/core";
import {
  ActorHandle,
  TxHash,
  TxSubmitter,
  makeCreateCounterFn,
  makeCreateHistogramFn,
} from "@nocturne-xyz/offchain-utils";
import * as ot from "@opentelemetry/api";
import retry from "async-retry";
import * as JSON from "bigint-json-serialization";
import { Job, Worker } from "bullmq";
import { ethers } from "ethers";
import { LogDescription } from "ethers/lib/utils";
import IORedis from "ioredis";
import { Logger } from "winston";
import { NullifierDB, RedisTransaction, StatusDB } from "./db";
import { checkRevertError } from "./opValidation";
import {
  ACTOR_NAME,
  OPERATION_BATCH_QUEUE,
  OperationBatchJobData,
} from "./types";

const COMPONENT_NAME = "submitter";

interface BundlerSubmitterMetrics {
  bundlesSubmittedCounter: ot.Counter;
  operationsSubmittedCounter: ot.Counter;
  operationStatusHistogram: ot.Histogram;
}

export class BundlerSubmitter {
  redis: IORedis;
  provider: ethers.providers.JsonRpcProvider;
  txSubmitter: TxSubmitter;
  tellerContract: Teller;
  handlerContract: Handler;
  statusDB: StatusDB;
  nullifierDB: NullifierDB;
  logger: Logger;
  metrics: BundlerSubmitterMetrics;
  finalityBlocks: number;

  readonly INTERVAL_SECONDS: number = 60;
  readonly BATCH_SIZE: number = 8;

  constructor(
    tellerAddress: Address,
    handlerAddress: Address,
    provider: ethers.providers.JsonRpcProvider,
    txSubmitter: TxSubmitter,
    redis: IORedis,
    logger: Logger,
    finalityBlocks = 1
  ) {
    this.redis = redis;
    this.logger = logger;
    this.statusDB = new StatusDB(this.redis);
    this.nullifierDB = new NullifierDB(this.redis);
    this.provider = provider;
    this.txSubmitter = txSubmitter;
    this.tellerContract = Teller__factory.connect(tellerAddress, this.provider);
    this.handlerContract = Handler__factory.connect(
      handlerAddress,
      this.provider
    );
    this.finalityBlocks = finalityBlocks;

    const meter = ot.metrics.getMeter(COMPONENT_NAME);
    const createCounter = makeCreateCounterFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );
    const createHistogram = makeCreateHistogramFn(
      meter,
      ACTOR_NAME,
      COMPONENT_NAME
    );

    this.metrics = {
      bundlesSubmittedCounter: createCounter(
        "bundles_submitted.counter",
        "Number of bundles submitted "
      ),
      operationsSubmittedCounter: createCounter(
        "operations_submitted.counter",
        "Number of operations submitted "
      ),
      operationStatusHistogram: createHistogram(
        "operation_status.histogram",
        "Histogram of operation statuses after submission"
      ),
    };
  }

  start(): ActorHandle {
    const worker = new Worker(
      OPERATION_BATCH_QUEUE,
      async (job: Job<OperationBatchJobData>) => {
        const operations: SubmittableOperationWithNetworkInfo[] = JSON.parse(
          job.data.operationBatchJson
        );

        const opDigests = operations.map((op) =>
          OperationTrait.computeDigest(op).toString()
        );
        const logger = this.logger.child({
          function: "submitBatch",
          bundle: opDigests,
        });

        // re-validate ops just before submission and remove any that now revert (marking them as
        // failing validation)
        const validOps: SubmittableOperationWithNetworkInfo[] = [];
        for (let i = 0; i < operations.length; i++) {
          const maybeErr = await checkRevertError(
            await this.txSubmitter.address(),
            this.tellerContract,
            this.handlerContract,
            this.provider,
            logger,
            operations[i]
          );

          if (maybeErr) {
            logger.error(
              `op failed. removing from batch. digest: ${opDigests[i]}`,
              { err: maybeErr }
            );
            const txs = [
              this.statusDB.getSetJobStatusTransaction(
                opDigests[i],
                OperationStatus.OPERATION_VALIDATION_FAILED
              ),
              ...this.nullifierDB.getRemoveNullifierTransactions(operations[i]),
            ];
            await this.redis.multi(txs).exec((maybeErr) => {
              if (maybeErr) {
                const msg = `failed to remove nullifiers from DB after op failed validation: ${maybeErr}`;
                logger.error(msg);
                throw new Error(msg);
              }
            });
          } else {
            validOps.push(operations[i]);
          }
        }

        if (validOps.length === 0) {
          logger.warn("no valid ops in batch. skipping submission.");
          return;
        }

        try {
          await this.submitBatch(logger, validOps);
        } catch (e) {
          logger.error("failed to submit bundle:", e);
        }

        this.metrics.operationsSubmittedCounter.add(validOps.length);
        this.metrics.bundlesSubmittedCounter.add(1);
      },
      { connection: this.redis, autorun: true }
    );

    this.logger.info(
      `submitter starting... teller contract: ${this.tellerContract.address}.`
    );

    const promise = new Promise<void>((resolve) => {
      worker.on("closed", () => {
        this.logger.info("submitter stopped.");
        resolve();
      });
    });

    return {
      promise,
      teardown: async () => {
        await worker.close();
        await promise;
      },
    };
  }

  async submitBatch(
    logger: Logger,
    operations: SubmittableOperationWithNetworkInfo[]
  ): Promise<void> {
    // TODO: this job isn't idempotent. If one step fails, bullmq will re-try
    // which may cause issues. Current plan is to mark reverted bundles as
    // failed. Will circle back after further testing and likely
    // re-queue/re-validate ops in the reverted bundle.

    logger.info("submitting bundle...");

    logger.debug("setting ops to inflight...");
    await this.setOpsToInflight(logger, operations);

    logger.debug("dispatching bundle...");
    const txHash = await retry(
      async () => await this.dispatchBundle(logger, operations),
      { retries: 3 }
    );
    logger.info("process bundle tx hash:", { txHash });

    if (!txHash) {
      logger.error("bundle reverted");
      return;
    }

    logger = logger.child({ txHash });
    logger.debug("performing post-submission bookkeeping");
    await this.performPostSubmissionBookkeeping(logger, operations, txHash);
  }

  async setOpsToInflight(
    logger: Logger,
    operations: SubmittableOperationWithNetworkInfo[]
  ): Promise<void> {
    // Loop through current batch and set each job status to IN_FLIGHT
    const inflightStatusTransactions = operations.map((op) => {
      const jobId = OperationTrait.computeDigest(op).toString();
      logger.info(
        `setting operation with digest ${jobId} to status IN_FLIGHT`,
        { opDigest: jobId }
      );
      return this.statusDB.getSetJobStatusTransaction(
        jobId,
        OperationStatus.IN_FLIGHT
      );
    });

    await this.redis.multi(inflightStatusTransactions).exec((maybeErr) => {
      if (maybeErr) {
        const msg = `failed to set job status transactions to IN_FLIGHT: ${maybeErr}`;
        logger.error(msg);
        throw new Error(msg);
      }
    });
  }

  async dispatchBundle(
    logger: Logger,
    operations: SubmittableOperationWithNetworkInfo[]
  ): Promise<TxHash | undefined> {
    try {
      logger.info("pre-dispatch attempting tx submission");

      // Calculate total gas limit based on op data because eth_estimateGas is not predictable for
      // processBundle
      const totalGasLimit = operations
        .map((op) => maxGasForOperation(op))
        .reduce((acc, gasForOp) => acc + gasForOp, 0n);

      const data = this.tellerContract.interface.encodeFunctionData(
        "processBundle",
        [{ operations }]
      );
      const txHash = await this.txSubmitter.submitTransaction(
        {
          to: this.tellerContract.address,
          data,
        },
        {
          gasLimit: Number(totalGasLimit),
          logger,
        }
      );

      logger.info(`confirmed processBundle tx. txhash: ${txHash}`);
      return txHash;
    } catch (err) {
      logger.error("failed to process bundle:", err);
      const redisTxs = operations.flatMap((op) => {
        const digest = OperationTrait.computeDigest(op);
        logger.error(
          `setting operation with digest ${digest} to status BUNDLE_REVERTED`
        );
        const statusTx = this.statusDB.getSetJobStatusTransaction(
          digest.toString(),
          OperationStatus.BUNDLE_REVERTED
        );

        const nullifierTx = this.nullifierDB.getRemoveNullifierTransactions(op);

        return [statusTx, ...nullifierTx];
      });

      await this.redis.multi(redisTxs).exec((maybeErr) => {
        if (maybeErr) {
          const msg = `failed to update operation statuses to BUNDLE_REVERTED and/or remove their nullifiers from DB: ${maybeErr}`;
          logger.error(msg);
          throw new Error(msg);
        }
      });

      this.metrics.operationStatusHistogram.record(operations.length, {
        status: OperationStatus.BUNDLE_REVERTED.toString(),
      });
      return undefined;
    }
  }

  async performPostSubmissionBookkeeping(
    logger: Logger,
    operations: SubmittableOperationWithNetworkInfo[],
    txHash: TxHash
  ): Promise<void> {
    const digestsToOps = new Map(
      operations.map((op) => [OperationTrait.computeDigest(op), op])
    );

    logger.info("waiting for processBundle tx to be mined", { txHash });
    await this.provider.waitForTransaction(txHash);

    logger.info("getting transaction receipt for processBundle tx", {
      txHash,
    });

    const receipt = await this.provider.getTransactionReceipt(txHash);
    logger.info("got transaction receipt for processBundle tx", {
      txHash,
      receipt,
    });

    const matchingEvents = parseEventsFromTransactionReceipt(
      receipt,
      this.tellerContract.interface,
      this.tellerContract.interface.getEvent("OperationProcessed")
    ) as LogDescription[];

    logger.info("matching events:", { matchingEvents });

    const redisTxs: RedisTransaction[] = [];
    const statuses: OperationStatus[] = [];
    for (const { args } of matchingEvents) {
      const digest = args.operationDigest.toBigInt();

      let status: OperationStatus;
      if (!args.assetsUnwrapped) {
        status = OperationStatus.OPERATION_PROCESSING_FAILED;
      } else if (!args.opProcessed) {
        status = OperationStatus.OPERATION_EXECUTION_FAILED;
      } else {
        status = OperationStatus.EXECUTED_SUCCESS;
      }

      logger.info(
        `setting operation with digest ${digest} to status ${status}`,
        { opDigest: digest, status: status.toString() }
      );
      redisTxs.push(
        this.statusDB.getSetJobStatusTransaction(digest.toString(), status)
      );
      statuses.push(status);

      if (status == OperationStatus.OPERATION_PROCESSING_FAILED) {
        logger.warn(
          `op with digest ${args.operationDigest.toBigInt()} failed during handleOperation. removing nullifers from DB...`,
          { opDigest: args.operationDigest.toBigInt() }
        );
        const op = digestsToOps.get(args.operationDigest.toBigInt())!;
        redisTxs.push(...this.nullifierDB.getRemoveNullifierTransactions(op));
      }
    }

    await this.redis.multi(redisTxs).exec((maybeErr) => {
      if (maybeErr) {
        const msg = `failed to set operation statuses and/or remove nullfiers after bundle executed: ${maybeErr}`;
        logger.error(msg);
        throw new Error(msg);
      }
    });

    // Record op statuses
    for (const status of statuses) {
      this.metrics.operationStatusHistogram.record(1, {
        status: status.toString(),
      });
    }
  }
}
