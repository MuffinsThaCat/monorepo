# Changelog

## 1.0.0

### Major Changes

- ccf1e594: consolidate batcher and submitter into the processor command

### Minor Changes

- ccf1e594: add batching preference functionality by refactoring batcher and server to support fast/medium/slow buffers

### Patch Changes

- 3978618d: fix bug in bundler submitter gas estimation that was using wrong from address
- Updated dependencies [909e8182]
  - @nocturne-xyz/client@4.1.1

## 0.10.11

### Patch Changes

- Updated dependencies [5f493cdf]
  - @nocturne-xyz/client@4.1.0

## 0.10.10

### Patch Changes

- Updated dependencies [08e6d2e0]
  - @nocturne-xyz/client@4.0.3

## 0.10.9

### Patch Changes

- 8b9d9030: submitter re-validates that op doesn't revert or internally revert to prevent against slippage-related reverts
- Updated dependencies [8b9d9030]
  - @nocturne-xyz/core@3.3.0
  - @nocturne-xyz/client@4.0.2
  - @nocturne-xyz/offchain-utils@0.6.5

## 0.10.8

### Patch Changes

- Updated dependencies [b321b41b]
- Updated dependencies [5a3afc72]
  - @nocturne-xyz/client@4.0.1
  - @nocturne-xyz/offchain-utils@0.6.4

## 0.10.7

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/client@4.0.0

## 0.10.6

### Patch Changes

- c390746f: Publish via yarn publish-packages not yarn changeset publish
- Updated dependencies [c390746f]
  - @nocturne-xyz/client@3.4.3
  - @nocturne-xyz/offchain-utils@0.6.3

## 0.10.5

### Patch Changes

- 812d2463: 1.2x gas limit, 2x was too high
- Updated dependencies [9e63e754]
- Updated dependencies [b7febfca]
- Updated dependencies [326fd2b2]
  - @nocturne-xyz/client@3.4.2
  - @nocturne-xyz/offchain-utils@0.6.2

## 0.10.4

### Patch Changes

- afcea436: fix gas limit multiplier
- 87d5bb40: dummy bump
- Updated dependencies [87d5bb40]
  - @nocturne-xyz/client@3.4.1
  - @nocturne-xyz/config@1.7.3
  - @nocturne-xyz/core@3.2.1
  - @nocturne-xyz/offchain-utils@0.6.1

## 0.10.3

### Patch Changes

- Updated dependencies [35875d78]
  - @nocturne-xyz/client@3.4.0

## 0.10.2

### Patch Changes

- 4aff3cd3: integrate tx submitter
- Updated dependencies [4aff3cd3]
- Updated dependencies [21d65e2b]
- Updated dependencies [f92a1cfe]
  - @nocturne-xyz/offchain-utils@0.6.0
  - @nocturne-xyz/client@3.3.0

## 0.10.1

### Patch Changes

- Updated dependencies [3ca99eaf]
  - @nocturne-xyz/core@3.2.0
  - @nocturne-xyz/client@3.2.1
  - @nocturne-xyz/offchain-utils@0.5.1

## 0.10.0

### Minor Changes

- fd8709ed: Add geo middleware to express server

### Patch Changes

- Updated dependencies [fd8709ed]
- Updated dependencies [c34c6b7a]
- Updated dependencies [9b17bc41]
- Updated dependencies [feb897cf]
  - @nocturne-xyz/offchain-utils@0.5.0
  - @nocturne-xyz/config@1.7.2
  - @nocturne-xyz/client@3.2.0

## 0.9.6

### Patch Changes

- empty bump
- Updated dependencies
  - @nocturne-xyz/offchain-utils@0.4.1
  - @nocturne-xyz/client@3.1.4
  - @nocturne-xyz/config@1.7.1
  - @nocturne-xyz/core@3.1.4

## 0.9.5

### Patch Changes

- 79aa7a82: Fix gas limit 50% buffer bigint math bug
- 57023ec4: check outgoing transfers against sanctions list
- Updated dependencies [41671325]
- Updated dependencies [1d5cefc2]
- Updated dependencies [79aa7a82]
- Updated dependencies [fdefa43b]
- Updated dependencies [4070b154]
  - @nocturne-xyz/client@3.1.3
  - @nocturne-xyz/config@1.7.0
  - @nocturne-xyz/offchain-utils@0.4.0
  - @nocturne-xyz/core@3.1.3

## 0.9.5-beta.0

### Patch Changes

- 79aa7a82: Fix gas limit 50% buffer bigint math bug
- 57023ec4: check outgoing transfers against sanctions list
- Updated dependencies [41671325]
- Updated dependencies
- Updated dependencies [79aa7a82]
- Updated dependencies [fdefa43b]
- Updated dependencies [4070b154]
  - @nocturne-xyz/client@3.1.3-beta.0
  - @nocturne-xyz/config@1.7.0-beta.0
  - @nocturne-xyz/offchain-utils@0.4.0-beta.0
  - @nocturne-xyz/core@3.1.3-beta.0

## 0.9.4

### Patch Changes

- Updated dependencies [8742f9a0]
  - @nocturne-xyz/config@1.6.0
  - @nocturne-xyz/client@3.1.2

## 0.9.3

### Patch Changes

- 1a2446d4: retry transaction up to 3 times if it fails
- Updated dependencies [3b9cf081]
- Updated dependencies [1b2530d1]
  - @nocturne-xyz/client@3.1.1
  - @nocturne-xyz/core@3.1.2
  - @nocturne-xyz/offchain-utils@0.3.2

## 0.9.2

### Patch Changes

- Updated dependencies [85811df6]
- Updated dependencies [b2938fc0]
- Updated dependencies [67b9116a]
- Updated dependencies [23243741]
- Updated dependencies [b56ead58]
- Updated dependencies [45d0719a]
  - @nocturne-xyz/client@3.1.0
  - @nocturne-xyz/config@1.5.0
  - @nocturne-xyz/core@3.1.1
  - @nocturne-xyz/offchain-utils@0.3.1

## 0.9.1

### Patch Changes

- Updated dependencies [fc7fa6c4]
  - @nocturne-xyz/config@1.4.0
  - @nocturne-xyz/client@3.0.5

## 0.9.0

### Minor Changes

- 724869eb: - update CLIs to reflect new logger semantics
  - replace all console logs with logger invocations

### Patch Changes

- 891de7e5: Change log level flag to just --log-level
- Updated dependencies [724869eb]
- Updated dependencies [891de7e5]
- Updated dependencies [317a0708]
  - @nocturne-xyz/offchain-utils@0.3.0
  - @nocturne-xyz/client@3.0.4

## 0.8.2

### Patch Changes

- Updated dependencies [26c43e44]
- Updated dependencies [2c465f4e]
- Updated dependencies [717ebcba]
- Updated dependencies [6fddaaa2]
- Updated dependencies [b49fd71f]
  - @nocturne-xyz/offchain-utils@0.2.0
  - @nocturne-xyz/client@3.0.3

## 0.8.1

### Patch Changes

- Updated dependencies [abfab3f2]
  - @nocturne-xyz/config@1.3.1
  - @nocturne-xyz/client@3.0.2

## 0.8.0

### Minor Changes

- c717e4d9: Revert forcedExit changes across the stack

### Patch Changes

- Updated dependencies [c717e4d9]
- Updated dependencies [d89a77e4]
- Updated dependencies [a94caaec]
- Updated dependencies [c717e4d9]
  - @nocturne-xyz/contracts@1.2.0
  - @nocturne-xyz/config@1.3.0
  - @nocturne-xyz/core@3.1.0
  - @nocturne-xyz/client@3.0.1
  - @nocturne-xyz/offchain-utils@0.1.18

## 0.7.0

### Minor Changes

- 257799c9: Add ability to pass oz relayer speed to actors
- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Patch Changes

- Updated dependencies [22abab87]
- Updated dependencies [a6275d8a]
- Updated dependencies [6ec2a7ac]
  - @nocturne-xyz/core@3.0.0
  - @nocturne-xyz/client@3.0.0
  - @nocturne-xyz/contracts@1.1.1
  - @nocturne-xyz/offchain-utils@0.1.17

## 0.6.0

### Minor Changes

- 5d90ac8e: Add `--bundler-address` flag to bundler server so op validation can simulate ops from bundler submitter address

### Patch Changes

- Updated dependencies [54b1caf2]
- Updated dependencies [e2801b16]
- Updated dependencies [2e641ad2]
- Updated dependencies [f80bff6a]
- Updated dependencies [5d90ac8e]
- Updated dependencies [5d90ac8e]
- Updated dependencies [8b3e1b2c]
- Updated dependencies [f80bff6a]
- Updated dependencies [5d90ac8e]
- Updated dependencies [fbfadb23]
- Updated dependencies [5d90ac8e]
  - @nocturne-xyz/contracts@1.1.0
  - @nocturne-xyz/core@2.2.0
  - @nocturne-xyz/config@1.2.0
  - @nocturne-xyz/offchain-utils@0.1.16

## 0.5.0

### Minor Changes

- 07625550: - CLI takes `finalityBlocks` from config and overrides with `--finality-blocks` option
  - submitter `tx.wait`'s for `finalityBlocks`

### Patch Changes

- Updated dependencies [444321c0]
- Updated dependencies [444321c0]
- Updated dependencies [7c190c2c]
- Updated dependencies [07625550]
- Updated dependencies [444321c0]
- Updated dependencies [07625550]
  - @nocturne-xyz/contracts@1.0.0
  - @nocturne-xyz/core@2.1.0
  - @nocturne-xyz/config@1.1.0
  - @nocturne-xyz/offchain-utils@0.1.15

## 0.4.3

### Patch Changes

- dcea2acb: Estimate bundle gas cost via operation data rather than processBundle eth_estimateGas (unpredictable)
- Updated dependencies [16dfb275]
- Updated dependencies [dcea2acb]
  - @nocturne-xyz/core@2.0.2
  - @nocturne-xyz/offchain-utils@0.1.14

## 0.4.2

### Patch Changes

- Updated dependencies [47a5f1e5]
- Updated dependencies [0ed9f872]
- Updated dependencies [46e47762]
- Updated dependencies [4d7147b6]
- Updated dependencies [7d151856]
- Updated dependencies [7d151856]
- Updated dependencies [46e47762]
  - @nocturne-xyz/config@1.0.0
  - @nocturne-xyz/core@2.0.1
  - @nocturne-xyz/contracts@0.5.0
  - @nocturne-xyz/offchain-utils@0.1.13

## 0.4.1

### Patch Changes

- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0
  - @nocturne-xyz/offchain-utils@0.1.12

## 0.4.0

### Minor Changes

- fb26901d: Reject failing ops before they're added to queue

### Patch Changes

- 2e934315: fix regression where op revert check used too high a gas price per proof verification
- Updated dependencies [6abd69b9]
- Updated dependencies [81598815]
- Updated dependencies [003e7082]
- Updated dependencies [1ffcf31f]
- Updated dependencies [fc364ae8]
- Updated dependencies [0cb20e3d]
- Updated dependencies [86d484ad]
- Updated dependencies [589e0230]
- Updated dependencies [6998bb7c]
- Updated dependencies [1ffcf31f]
- Updated dependencies [77c4063c]
- Updated dependencies [6998bb7c]
- Updated dependencies [77c4063c]
- Updated dependencies [35b0f76f]
- Updated dependencies [77c4063c]
- Updated dependencies [589e0230]
- Updated dependencies [3be7d366]
- Updated dependencies [9098e2c8]
- Updated dependencies [de88d6f0]
- Updated dependencies [58b363a4]
- Updated dependencies [003e7082]
- Updated dependencies [77c4063c]
- Updated dependencies [58b363a4]
- Updated dependencies [f8046431]
  - @nocturne-xyz/core@1.0.0
  - @nocturne-xyz/contracts@0.4.0
  - @nocturne-xyz/config@0.4.0
  - @nocturne-xyz/offchain-utils@0.1.11

## 0.3.0

### Minor Changes

- fix publish command

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/contracts@0.3.0
  - @nocturne-xyz/config@0.3.0
  - @nocturne-xyz/core@0.3.0

## 0.2.0

### Minor Changes

- 6c0a5d7c: overhaul monorepo structure & start proper versioning system

### Patch Changes

- Updated dependencies [6c0a5d7c]
  - @nocturne-xyz/contracts@0.2.0
  - @nocturne-xyz/config@0.2.0
  - @nocturne-xyz/core@0.1.4

### Unreleased

- replace tx manager with OZ relay
- update relay schema after collapsing tracked assets into single array
- use `SubmittableOperation` type everywhere instead of old `ProvenOperation` (now that joinsplits and assets are separated)
- modify ajv validation after eip712 operation changes
- integrate tx manager to fix stuck txs
- put back redis utils
- make logging more consistent
- manually estimate gasPrice given implicit gas price estimate in function calls is too high
- add metrics to server, batcher, and submitter components
- add health check to server
- fix bug with marking op reverted and NFs unused (redis txs misformatted)
- bump sdk with joinsplit sorting and note timestamp changes
- add `gasAssetRefundThreshold` to operation for req validation
- make cli manually exit when `ActorHandle` promise resolves
- make `BundlerServer.start()` return `ActorHandle`
- change `/relay` request structure to have operation embedded on obj `{ operation: {...}}`
- move req/res types into sdk so it can be shared with fe-sdk
- make req/res structs in `request` module
- move redis, ajv, and actor related utils to `offchain-utils` pkg
- update `.env.example`
- go back to only one docker-compose file
- add `--stdout-log-level` option to CLI
- tag docker image with nocturnelabs org name
- add `yarn build:docker-compose` which builds docker compose
- `yarn build:docker` now builds CLI container, not docker compose.
- submitter checks `op.opProcessed` for failures and marks failed execution if so
- CLI uses config package to get contract addresses
- remove gas hardcode in submitter `processBundle`
- add `--log-dir` option to CLI with defaults
- add winston logging
  - replace validator with functions
  - replace router with functions
- add encrypted sender address fields to relay validator
- Detect ops that reverted during processing and remove their NFs from DB
- Decompose `Submitter.submitBatch` into setting ops inflight, dispatching bundle, and book-keeping post-submission
- Parse `OperationResult.assetsUnwrapped` to differentiate btwn failed op processing and failed op execution
- Update operation JSON fixture for request validation after adding `atomicActions`
- when `processBundle` reverts, remove the bundle's nullifiers from `NullifierDB`
- Update operation JSON fixture for request validation after adding `chainId` and `deadline`
- set operation status to `BUNDLE_REVERTED` when `processBundle` reverts
- return status code `500` when job enqueue fails
- return status code `404` when job not found
- make server, batcher, and submitter stoppable by renaming `run` to `start` and returning a "close" function
- Move env var parsing to CLI
- add `ignoreGas` option to validator
- Remove `verificationGasLimit` from `Operation`
- Change `docker-compose.yml` to have redis `volumes: ./redis-data:/data` to `volumes: /redis-data` (volumes finally mount on docker env instead of host machine)
- update imports with SDK renames (see SDK changelog)
- use `--max-latency` option for batcher in `docker-compose.yml`
- move `OperationStatus` enum to `@nocturne-xyz/core`
- use `node:18.12.1` in dockerfile
- Add docker internal host gateway network to server and submitter so they can connect to hh
- Expose server ports in docker compose file
- Add `cors` middleware to server
- Remove unused env var from `.env.example`
- `BundlerServer.run` returns `http.Server`
- Merge `joinSplitTx.encodedAssetAddr` and `joinSplitTx.encodedAssetId` into one field `joinSplitTx.encodedAsset`
- Add Dockerfile and docker-compose.yml that allows you to run all three bundler components together
- Add readme explaining components and how to use the CLI tool
- Add `cli` directory to bundler + CI tests
- Add `BundlerServer`, `BundlerBatcher` and `BundlerSubmitter`
- Add `bundler` package
