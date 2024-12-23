import { makeLogger } from "@nocturne-xyz/offchain-utils";
import { Command } from "commander";
import { requireApiKeys } from "../../../utils";
import { createWriteStream } from "fs";
import { API_CALL_MAP, ApiCallNames } from "../../../screening/checks/apiCalls";
import { sleep } from "@nocturne-xyz/core";
import * as JSON from "bigint-json-serialization";
import {
  CachedAddressData,
  ensureExists,
  formDepositInfo,
  getLocalRedis,
} from "./helpers/utils";
import { parseAndFilterCsvOfAddresses } from "@nocturne-xyz/data";

/**
 * Example
 * yarn deposit-screener-cli inspect snapshot --input-csv ./data/addresses.csv --output-data ./data/addresses.json --delay-ms 3000 --log-level info
 */
const runSnapshot = new Command("snapshot")
  .summary("create data snapshot for CSV or JSON file of addresses")
  .description(
    "analyzes a list of addresses, provides acceptance metrics and rejection reasons"
  )
  .requiredOption(
    "--input-csv <path>",
    "path to the CSV file containing addresses to inspect, first column contains the addresses to verify"
  )
  .requiredOption(
    "--output-data <path>",
    "path to the JSON file to write the output data to"
  )
  .option(
    "--log-dir <string>",
    "directory to write logs to. if not given, logs will only be emitted to stdout."
  )
  .option(
    "--delay-ms <number>",
    "delay ms between requests to avoid rate limits (in ms)",
    "500"
  )
  .option("--log-level <string>", "min log importance to log to stdout.")
  .action(main);

async function main(options: any): Promise<void> {
  requireApiKeys();

  const { inputCsv, outputData, logDir, logLevel, delayMs } = options;
  ensureExists(inputCsv, { path: outputData, type: "FILE" });

  const logger = makeLogger(
    "dev",
    "address-checker",
    "checker",
    logLevel,
    logDir
  );

  logger.info(`Starting snapshot for addresses from ${inputCsv}`);
  const dedupedAddresses = await parseAndFilterCsvOfAddresses(inputCsv, {
    dedupAddresses: true,
  });
  const numAddresses = dedupedAddresses.length;

  const writeStream = createWriteStream(outputData, { encoding: "utf-8" });
  writeStream.write("{");

  process.on("SIGINT", async () => {
    logger.info("Caught interrupt signal");
    await new Promise<void>((resolve) => {
      writeStream.end("}", () => {
        logger.info("Snapshot saved successfully");
        resolve();
      });
    });
    process.exit(0);
  });

  logger.info(`There are ${numAddresses} addresses to snapshot`);
  let count = 0;

  for (const address of dedupedAddresses) {
    logger.info(
      `Starting API calls for address: ${address} ——— ${(count += 1)} of ${numAddresses}`
    );

    const deposit = formDepositInfo(address);
    const addressData: CachedAddressData = {};
    for (const [callName, apiCall] of Object.entries(API_CALL_MAP)) {
      if (
        callName === API_CALL_MAP.MISTTRACK_ADDRESS_OVERVIEW.name ||
        callName === API_CALL_MAP.MISTTRACK_ADDRESS_RISK_SCORE.name ||
        callName === API_CALL_MAP.MISTTRACK_ADDRESS_LABELS.name
      ) {
        logger.debug(
          `Sleeping for ${delayMs} ms to avoid Misttrack rate limit...`
        );
        await sleep(delayMs);
      }

      logger.info(`Calling ${callName} for ${address}...`);
      const redis = await getLocalRedis();
      try {
        addressData[callName as ApiCallNames] = await apiCall(deposit, redis, {
          ttlSeconds: 48 * 60 * 60,
        });
        logger.info(`Successfully called ${callName} for ${address}`);
      } catch (err) {
        logger.error(`Failed to call ${callName} for ${address}: ${err}`);
        logger.warn(`Exiting snapshot run early!`);
        break;
      }
    }

    writeStream.write(`"${address}": ${JSON.stringify(addressData)}`);
    // Add a comma only if this is not the last address
    if (count < numAddresses) {
      writeStream.write(",");
    }
  }

  // Returning a promise that resolves when writing finishes
  await new Promise<void>((resolve) => {
    writeStream.end("}", () => {
      logger.info("Snapshot saved successfully");
      resolve();
    });
  });
}

export default runSnapshot;
