import IORedis from "ioredis";
import { ClosableAsyncIterator } from "@nocturne-xyz/core";
import * as JSON from "bigint-json-serialization";
import { Logger } from "winston";
import {
  RedisStreamId,
  RedisStreamIdTrait,
  WithRedisStreamId,
} from "./redisStreamId";

const REDIS_BATCH_SIZE = 100;
const REDIS_BATCH_SIZE_STRING = REDIS_BATCH_SIZE.toString();

export interface InsertionLogOptions {
  logger: Logger;
}

export interface ScanXreadOptions {
  // maximum amount time in milliseconds to block for new data before on each call to XREAD
  // defaults to 30000 (30 seconds)
  pollTimeout?: number;
}

export interface ScanOptions {
  // if given, the iterator will only return elements with index > `startId`
  // if this id is >= current tip AND `terminateOnEmpty` is set to `false`, the returned iterator will be empty
  startId?: RedisStreamId;

  // if given, the iterator will only return elements with index < `endId`,
  // and it will terminate once the iterator reaches `endId`
  // if this id > current tip AND `terminateOnEmpty` is set to `false`, the returned iterator will terminate before `endId` is reached
  endId?: RedisStreamId;

  // if true, returned iterator will terminate once it reaches the end of the log and there's no more data
  // if false, returned iterator will block and wait for new data when it reaches the end of the log
  // defaults to true
  terminateOnEmpty?: boolean;

  // see `ScanXreadOptions` for more details
  xreadOptions?: ScanXreadOptions;
}

export class PersistentLog<T> {
  private redis: IORedis;
  private logger?: Logger;
  private streamKey: string;

  constructor(
    redis: IORedis,
    streamKey: string,
    options?: InsertionLogOptions
  ) {
    this.redis = redis;
    this.logger = options?.logger;
    this.streamKey = streamKey;
  }

  async getTip(): Promise<RedisStreamId | undefined> {
    const lastEntry = await this.redis.xrevrange(
      this.streamKey,
      "+",
      "-",
      "COUNT",
      "1"
    );
    if (lastEntry.length > 0) {
      return lastEntry[0][0] as RedisStreamId;
    }
    return undefined;
  }

  async push(elems: WithRedisStreamId<T>[]): Promise<void> {
    this.logger &&
      this.logger.debug(`Pushing ${elems.length} elements via x-add`);
    if (elems.length === 0) {
      return;
    }

    let multi = this.redis.multi();
    for (const { inner, id } of elems) {
      multi = multi.xadd(
        this.streamKey,
        id,
        "inner",
        JSON.stringify({ inner })
      );
    }

    await multi.exec((maybeError) => {
      if (maybeError) {
        this.logger &&
          this.logger.error(`Error pushing elements`, { error: maybeError });

        throw maybeError;
      }

      this.logger && this.logger.debug(`Pushed ${elems.length} elements`);
    });
  }

  // returns a closable async iterator over elements in the log
  // iterator behavior can be configured via `options`.
  // By default, it will return an iterator over all elements in the log
  // and terminate once it reaches the end of the log.
  // see `ScanOptions` for more details
  scan(options?: ScanOptions): ClosableAsyncIterator<WithRedisStreamId<T>[]> {
    const redis = this.redis;
    const logger = this.logger;
    const streamKey = this.streamKey;
    const terminateOnEmpty = options?.terminateOnEmpty ?? true;

    const pollTimeout = (
      options?.xreadOptions?.pollTimeout ?? 30000
    ).toString();

    // include the "BLOCK" argument if `terminateOnEmpty` is false
    const poll = async (lowerBound: RedisStreamId) => {
      let entriesByStream;
      if (terminateOnEmpty) {
        entriesByStream = await redis.xread(
          "COUNT",
          REDIS_BATCH_SIZE_STRING,
          "STREAMS",
          streamKey,
          lowerBound
        );
      } else {
        entriesByStream = await redis.xread(
          "COUNT",
          REDIS_BATCH_SIZE_STRING,
          "BLOCK",
          pollTimeout,
          "STREAMS",
          streamKey,
          lowerBound
        );
      }

      // we only care about one stream, and we only care about the entries themselves
      // [0] gets the [key, entries] pair for the 0th stream, [1] gets the entries themselves
      return entriesByStream?.[0][1];
    };

    // start at `startTotalEntityIndex` if it was given
    let lowerBound = options?.startId ?? "0-0";
    logger && logger.debug(`starting scan from ${lowerBound}`);
    let closed = false;
    const generator = async function* () {
      while (!closed) {
        const entries = await poll(lowerBound);
        logger && logger.debug(`polled - got ${entries?.length ?? 0} entries`);

        // if there's no data and `options.terminateOnEmpty` is `false`, then we
        // should simply poll again, neither yielding nor terminating
        // if there's no data and `options.terminateOnEmpty` is `true`, then
        // we should terminate
        if ((!entries || entries.length === 0) && terminateOnEmpty) {
          break;
        } else if (!entries || entries.length === 0) {
          continue;
        }

        // not necessarily typesafe - we assume the caller pointed it to the right redis stream
        let batch = entries.map(([id, fields]) => {
          const inner = JSON.parse(fields[1]).inner as T;
          return { id: RedisStreamIdTrait.fromString(id), inner };
        });

        // filter out all data >= `options.endId` if given
        if (options?.endId !== undefined) {
          const endId = options.endId;
          batch = batch.filter(({ id }) => RedisStreamIdTrait.lt(id, endId));
          // if there's no more data after filtering, terminate
          if (batch.length == 0) {
            break;
          }
        }

        yield batch;

        const lastId = batch[batch.length - 1].id;
        lowerBound = RedisStreamIdTrait.fromString(lastId);
      }

      // not sure if we need this, but we should probably start doing this in hand-written iters
      // I have a sinking feeling not doing so might cause bugs later down the line
      closed = true;
    };

    return new ClosableAsyncIterator(generator(), async () => {
      closed = true;
    });
  }
}
