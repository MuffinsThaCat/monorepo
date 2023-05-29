import { Request, RequestHandler, Response } from "express";
import { tryParseQuoteRequest } from "./request";
import { Logger } from "winston";
import {
  estimateSecondsUntilDepositCompletion,
  estimateSecondsUntilCompletionForProspectiveDeposit,
} from "./waitEstimation";
import { ScreenerDelayCalculator } from "./screenerDelay";
import {
  Address,
  DepositStatusResponse,
  DepositQuoteResponse,
} from "@nocturne-xyz/sdk";
import { ScreeningApi } from "./screening";
import { DepositScreenerDB } from "./db";
import { Queue } from "bullmq";
import { DepositRequestJobData } from "./types";

export interface DepositStatusHandlerDeps {
  db: DepositScreenerDB;
  logger: Logger;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
  rateLimits: Map<Address, bigint>;
}

export function makeDepositStatusHandler({
  logger,
  db,
  screenerQueue,
  fulfillerQueues,
  rateLimits,
}: DepositStatusHandlerDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    const depositHash = req.params.depositHash;

    const maybeStatus = await db.getDepositRequestStatus(depositHash);
    if (!maybeStatus) {
      const errorMsg = `deposit request with hash ${depositHash} not found`;
      logger.warn(errorMsg);
      res.statusMessage = errorMsg;
      res.status(400).json(errorMsg);
      return;
    }

    let delay: number;
    try {
      delay = await estimateSecondsUntilDepositCompletion(
        { db, screenerQueue, fulfillerQueues, rateLimits },
        depositHash
      );
    } catch (err) {
      logger.warn(err);
      res.statusMessage = String(err);
      res.status(400).json(err);
      return;
    }

    const response: DepositStatusResponse = {
      status: maybeStatus,
      estimatedWaitSeconds: delay,
    };
    res.json(response);
  };
}

export interface QuoteHandlerDeps {
  logger: Logger;
  screeningApi: ScreeningApi;
  screenerDelayCalculator: ScreenerDelayCalculator;
  screenerQueue: Queue<DepositRequestJobData>;
  fulfillerQueues: Map<Address, Queue<DepositRequestJobData>>;
  rateLimits: Map<Address, bigint>;
}

export function makeQuoteHandler({
  logger,
  screeningApi,
  screenerDelayCalculator,
  screenerQueue,
  fulfillerQueues,
  rateLimits,
}: QuoteHandlerDeps): RequestHandler {
  return async (req: Request, res: Response) => {
    const errorOrQuoteRequest = tryParseQuoteRequest(req.body);
    if (typeof errorOrQuoteRequest == "string") {
      logger.warn("request validation failed", errorOrQuoteRequest);
      res.statusMessage = errorOrQuoteRequest;
      res.status(400).json(errorOrQuoteRequest);
      return;
    }

    const quoteRequest = errorOrQuoteRequest;

    if (!rateLimits.has(quoteRequest.assetAddr)) {
      const errorMsg = `asset ${quoteRequest.assetAddr} is not supported`;
      logger.warn(errorMsg);
      res.statusMessage = errorMsg;
      res.status(400).json(errorMsg);
      return;
    }

    let quote: number;
    try {
      quote = await estimateSecondsUntilCompletionForProspectiveDeposit(
        {
          screeningApi,
          screenerDelayCalculator,
          screenerQueue,
          fulfillerQueues,
          rateLimits,
        },
        quoteRequest.spender,
        quoteRequest.assetAddr,
        quoteRequest.value
      );
    } catch (err) {
      logger.warn(err);
      res.statusMessage = String(err);
      res.status(400).json(err);
      return;
    }

    const response: DepositQuoteResponse = { estimatedWaitSeconds: quote };
    res.json(response);
  };
}