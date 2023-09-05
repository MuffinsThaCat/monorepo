# Changelog

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