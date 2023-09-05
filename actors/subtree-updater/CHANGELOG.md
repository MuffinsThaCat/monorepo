# Changelog

## 0.3.0

### Minor Changes

- fix publish command

### Patch Changes

- Updated dependencies
  - @nocturne-xyz/crypto-utils@0.3.0
  - @nocturne-xyz/contracts@0.3.0
  - @nocturne-xyz/config@0.3.0
  - @nocturne-xyz/core@0.3.0

## 0.2.0

### Minor Changes

- 6c0a5d7c: overhaul monorepo structure & start proper versioning system

### Patch Changes

- Updated dependencies [6c0a5d7c]
  - @nocturne-xyz/crypto-utils@0.2.0
  - @nocturne-xyz/contracts@0.2.0
  - @nocturne-xyz/config@0.2.0
  - @nocturne-xyz/core@0.1.4

### Unreleased

- replace tx manager with OZ relay
- rewrite `SubtreeUpdater` class to not use bullmq. instead it's just one big `ClosableAsyncIterator`
- remove duplicated `log.push` call in `syncAndPipe` to fix double insertion bug
- add metrics
- use tx manager
- iterate over `PersistentLog` first, then start pulling from subgraph
- add `PersistentLog`
- put back redis utils
- make logging more consistent
- add logger to `SubgraphSubtreeUpdaterSyncAdapter`
- sync through current block, not merely up to it
- make teardown actually wait for all proms to settle
- fix edge case that can cause totalEntityIndex to go backwards in subgraph sync adapter
- sync `TreeInsertioEvent`s instead of notes and fill batch events individually
- sync by TotalEntityIndex instead of block ranges
- reduce chunk size down from 100000 to 50
- use merkle index from insertions instead of separate counter
- subgraph sync checks if `res.data` undefined
- change sync adapter to use joinsplits, refunds, and fill batch with zero events to yield insertions
- bump sdk with joinsplit sorting and note timestamp changes
- import `BATCH_SIZE` from `TreeConstants`
- make cli manually exit when `ActorHandle` promise resolves
- get `subtreeIndex`, not `subtreeBatchOffset` from subgraph when determining whether or not to enqueue proof job
- close other workers/iters/async "threads" when one of them fails
- add `--stdout-log-level` post-rewrite
- pull start block from config in cli
- ignore fill batch failure in case where batch already filled
- only prune tree after proof job is submitted to bullmq
- update .env.example
- add docker-compose file
- complete overhaul, including the following changes:
  - syncAdapter iterates over tree insertions
  - no persistence - instead recovers by scanning through insertions from subgraph
  - skips proving for already-submitted updates
  - fillBatch logic is now based on a cancellable timeout that's overridden every time an insertion is made instead of an interval
  - bullMQ to handle / persist queued / unfinished / failed jobs
  - redis instead of lmdb
- add `--stdout-log-level` option to CLI
- tag docker images with nocturnelabs org name
- scan through all insertions starting from index 0 when recovering
- take handler address via config in CLI via `--config-name-or-path`
- add `--log-dir` option to CLI with defaults
- add winston logging
- make `SubtreeUpdateServer.start()` non-async, as it doesn't need to be async
- get rid of mutex on submitter
- add `tx.wait` to submitter
- Sync tree events from `handler` contract instead of wallet post-contract-separation
- move `packToSolidityProof`, `unpackFromSolidityProof`, and `SolidityProof` into `proof/utils`
- Rename `SUBMITTER_SECRET_KEY` to `TX_SIGNER_KEY`
- Add separate script for building mock docker
- update imports with SDK renames (see SDK changelog)
- add mutex to avoid nonce conflicts when filling batch (hack)
- add CLI option to ensure a batch is submitted every time the updater polls by filling with zeros
- Add `interval` and `indexingStartBlock` as options to server
- Remove circuit-artifacts download for mock updater
- change `build_docker.sh` to avoid `docker buildx` when building mock subtree updater
- add `yarn build:mock:docker` script and corresponding functionality in `build_docker.sh`
- create separate subtree updater dockerfile that doesn't use rapidsnark
- change CLI to allow using mock subtree update prover
- fix dir not existing in rapidsnark prover
- remove install deps from dockerfile
- Add a script `yarn build:docker` to build the dockerized subtree updater
- Switch to CLI options for all non-secrets
- Add CLI instructions to readme
- Move most CLI params into env vars
- Dockerize
- Remove `toJSON` and all `fromJSON` methods in favor of custom `bigint-json-serialization`
- modify `SubtreeUpdater` to index `SubtreeUpdate` events and use those to determine when insertions are committed
- spit `tryGenAndSubmitProofs` into separate method
- separately enqueue batches to be committed
- move server to its own module
- add tests for rapidsnark prover
- add `SubtreeUpdater`
- add rapidsnark prover