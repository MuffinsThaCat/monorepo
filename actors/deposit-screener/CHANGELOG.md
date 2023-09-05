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
- revert back to ethers eip712 signer after fixing typehash ordering
- switch on screening/delay components in server/processor CLI
- delete all dummy magic values and hardcode into dummy impls
- add ENVIRONMENT env var to make sure we don't use dev values in production
- fix bug where res.json(...) in deposit DNE case was not returning immediately after
- fix bug where screener method to find closest job doesn't use our bigint JSON library
- return errors to user in screener server /quote
- use tx manager
- return successfully with deposit status `DoesNotExist` if the given deposit request DNE
- use error code 500, not 400 for wait estimation failures
- fix server cli to also take `--dummy-screener-delay`
- add dummy magic long delay value to cause dummy screener to give 3h delay
- add dummy magic rejection value for screener to reject some deposits (test purposes)
- put back redis utils
- make logging more consistent
- add logger to `SubgraphScreenerSyncAdapter`
- sync through current block, not merely up to it
- randomness to screener delay
- fix edge case that can cause totalEntityIndex to go backwards in subgraph sync adapter
- sync by TotalEntityIndex instead of block ranges
- check in screener and fulfiller that deposit request still outstanding
- fix bug in docker compose that pointed to bundler package not screener
- instrument screener and fulfiller components with opentel metrics
- add health check to server
- add dummy screening delay option to processor CLI
- subgraph sync checks if `res.data` undefined
- use custom implementation of EIP712 signer instead of ethers
- make EIP712 typehash / signature to use new compressed address encoding
- fix wrong service name in bundler server run cmd
- server start returns `ActorHandle` and awaits promise to avoid early exit
- bump sdk with joinsplit sorting and note timestamp changes
- move deposit hash calculation into sdk, fix imports
- make cli manually exit when `ActorHandle` promise resolves
- move req/res types into sdk so it can be shared with fe-sdk
- remove all usage of ticker in processor and server (strictly worse than address, more clutter)
- add server component which exposes `/status/:depositHash` and `/quote`
- expose two methods in `waitEstimation` to estimate time for existing deposits and for prospective deposits
- add `waitEstimation` module which takes queue and delay and gives rough estimate of aggregate delay
- rename `delay` module to `screenerDelay` so its clear its delay from first screen to second
- DB stores depositHash -> depositRequest in screener for future use (alternative was using subgraph)
- close other workers/iters/async "threads" when one of them fails
- add window recovery logic to fulfiller
- add fulfiller to `docker-compose.yml`
- add fulfiller to CLI
- add fulfillment queue logic in `DepositScreenerFulfiller`
  - have separate fulfillment queue for each asset
  - make a bullmq `Worker` for each queue that enforces rate limit
  - move tx submission into fulfiller
- add `DepositRateLimiter` that keeps track of a moving window of recent deposits and can check if rate limit would be exceeded.
- update `.env.example`
- go back to only one docker-compose file
- add `--stdout-log-level` option to CLI
- processor switches on token type and calls `completeErc20Deposit`
- add `--throttle-ms` arg to CLI
- bump max chunk size up to 100K blocks
- add optional argument `queryThrottleMs` to `DepositScreenerProcessor.start` and use it when instantiating iterator
- add support for `throttleMs` option to sync adapter
- pull `startBlock` from `config.contracts` and pass it to `startBlock` in processor cli
- add `startBlock` parameter to `DepositScreenerProcessor`
- subgraph fetch functions query via `idx_gte` and `idx_lt` instead of `id_gte` and `id_lt`
- create separate `docker-compose.local.yml` and `docker-compose.dev.yml` where `dev` version pulls from docker hub
- tag docker image with nocturnelabs org name
- add `yarn build:docker-compose` which builds docker compose
- `yarn build:docker` now builds CLI container, not docker compose.
- CLI uses config package to get contract addresses
- add `--log-dir` option to CLI with defaults
- add winston logging
- add 5 retries with exponential backoff to deposit screener
- fix `SubgraphScreenerSyncAdapter` querying entire history instead of only specified range
- Update eip712 signing to not include `chainId` in `DepositRequest` (already included in eip712 domain)
- make processor stoppable by renaming `run` to `start` and returning a "close" function
- print errors in console
- Fix bug where `depositRequest.depositAddr` was being incorrectly copied over from subgraph
- Add Dockerfile and docker-compose.yml
- Delete `enqueue.ts` and move logic into `processor.ts`
- Move env var parsing to CLI
- Add stubs for non-server screener functionality
  - Processor (fetches new deposit events, checks, enqueues)
  - Submitter (takes new deposit requests of queue and signs/submits)
  - DB implementation for storing rate limits and statuses
  - Sync submodule that currently only has subgraph impl
  - CLI submodule to start components
  - Screening submodule (mocked)
  - Delay sumodule (mocked)
- Break out signing and hashing into `typeData` submodule
- Add deposit request hash to contract fixture
- Add subgraph query functionality + test script to ensure it works
- Add EIP712 signing logic + script for generating fixture