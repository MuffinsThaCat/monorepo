# Changelog

## 0.12.6

### Patch Changes

- Updated dependencies [8b9d9030]
  - @nocturne-xyz/core@3.3.0

## 0.12.5

### Patch Changes

- 87d5bb40: dummy bump
- Updated dependencies [87d5bb40]
  - @nocturne-xyz/config@1.7.3
  - @nocturne-xyz/core@3.2.1

## 0.12.4

### Patch Changes

- Updated dependencies [3ca99eaf]
  - @nocturne-xyz/core@3.2.0

## 0.12.3

### Patch Changes

- c34c6b7a: add logging to deploy script checker
- Updated dependencies [c34c6b7a]
  - @nocturne-xyz/config@1.7.2

## 0.12.2

### Patch Changes

- empty bump
- Updated dependencies
  - @nocturne-xyz/config@1.7.1
  - @nocturne-xyz/core@3.1.4

## 0.12.1

### Patch Changes

- Updated dependencies [1d5cefc2]
- Updated dependencies [4070b154]
  - @nocturne-xyz/config@1.7.0
  - @nocturne-xyz/core@3.1.3

## 0.12.1-beta.0

### Patch Changes

- Updated dependencies
- Updated dependencies [4070b154]
  - @nocturne-xyz/config@1.7.0-beta.0
  - @nocturne-xyz/core@3.1.3-beta.0

## 0.12.0

### Minor Changes

- 8742f9a0: Add mainnet deploy config

### Patch Changes

- Updated dependencies [8742f9a0]
  - @nocturne-xyz/config@1.6.0

## 0.11.1

### Patch Changes

- Updated dependencies [1b2530d1]
  - @nocturne-xyz/core@3.1.2

## 0.11.0

### Minor Changes

- b2938fc0: Refactor deploy script to check all state vars of core AND adapter contracts

### Patch Changes

- Updated dependencies [b2938fc0]
- Updated dependencies [45d0719a]
  - @nocturne-xyz/config@1.5.0
  - @nocturne-xyz/core@3.1.1

## 0.10.1

### Patch Changes

- Updated dependencies [fc7fa6c4]
  - @nocturne-xyz/config@1.4.0

## 0.10.0

### Minor Changes

- caf815d8: Separate out contract owner from proxy admin owner for contract ownership transfers
- caf815d8: Optionally deploy uniswap v3 adapter

## 0.9.2

### Patch Changes

- 79ef1b31: proxy deployment attaches prev missing constructor args, send verifications to etherscan in batches of 2 to avoid rate limits
- 79ef1b31: execAsync sends logs to stdout when running hardhat verify

## 0.9.1

### Patch Changes

- Updated dependencies [abfab3f2]
  - @nocturne-xyz/config@1.3.1

## 0.9.0

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

## 0.8.0

### Minor Changes

- 6ec2a7ac: Add verification script + make deploy script collect verification data
- a6275d8a: - split `core` in half, creating a new `client` package that houses `NocturneClient` and everything around it
  - moved all "sync adapter" interfaces into `core`
  - moved all "sync adapter" implementations into data-source-specific packages `rpc-sync-adapters`, `subgraph-sync-adapters`, and `hasura-sync-adapters`

### Patch Changes

- Updated dependencies [22abab87]
- Updated dependencies [a6275d8a]
- Updated dependencies [6ec2a7ac]
  - @nocturne-xyz/core@3.0.0
  - @nocturne-xyz/contracts@1.1.1

## 0.7.0

### Minor Changes

- 5d90ac8e: Add bundlers field to deploy config and whitelist those bundlers in deploy
- ad41f0d5: Add optional reth adapter deploy to deploy script

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

## 0.6.0

### Minor Changes

- 07625550: add optional `finalityBlocks` to config's `network` property that makes it easier to set `finalityBlocks` in sync logic across the codebase

### Patch Changes

- 9058f77b: Await num confirmations when deploying implementation contracts to avoid unexpected reverts with slow confirmation
- 444321c0: Change whitelisted fn signature to 'deposit' instead of 'convert'
- Updated dependencies [444321c0]
- Updated dependencies [444321c0]
- Updated dependencies [7c190c2c]
- Updated dependencies [07625550]
- Updated dependencies [444321c0]
- Updated dependencies [07625550]
  - @nocturne-xyz/contracts@1.0.0
  - @nocturne-xyz/core@2.1.0
  - @nocturne-xyz/config@1.1.0

## 0.5.1

### Patch Changes

- Updated dependencies [16dfb275]
- Updated dependencies [dcea2acb]
  - @nocturne-xyz/core@2.0.2

## 0.5.0

### Minor Changes

- 47a5f1e5: Deploy script deploys eth transfer adapter and adds to protocol allowlist

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

## 0.4.1

### Patch Changes

- Updated dependencies [9fccc32f]
- Updated dependencies [543af0b0]
- Updated dependencies [543af0b0]
  - @nocturne-xyz/core@2.0.0

## 0.4.0

### Minor Changes

- e2dfea9d: add goerli config before redeploy, fix regressions in sepolia config (`resetWindowHours` was not included in sepolia deploy config)
- 6998bb7c: add resetWindowHours to deploy config in config package and deploy package
- 77c4063c: Add CanonicalAddressRegistry and sig check verifier to deploy and config packages
- e2dfea9d: deploy script conditionally deploys wsteth adapter, takes optional wsteth adapter deploy config in deploy config json

### Patch Changes

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

### Unreleased

- call whitelist on supported contracts (tokens + protocols)
- Include teller contract name and version in Teller init call
- deploy and init Handler atomically, then `setTeller` afterwards (prevent front-running)
- support separate token whitelist
- revert back to per-method protocol allowlist
- add dev only upgrade script that assumes deployer = proxyAdmin owner
- add "bump configs package` to readme
- update `README` with better instructions on how to deploy
- update sepolia deploy config
- reserve tokens to TX signer when deploying test erc20s
- checker script ensures token caps are set in dep manager and everything is whitelisted as expected
- refactor deploy fn to all handle potential token deployment, token cap setting, core contract deployment, token + protocol whitelisting, and ownership transfer
- add erc20s field to deploy configs
- protocol whitelisting removes function selectors
- add deploy config for sepolia
- separate ownership transferral from contract deployment
- add `whitelistProtocols` function
- remove empty `console.log()` in place of `\n` again
- separate configs types out into separate `config.ts` again
- add `protocolAllowlist` to example config
- take data out of env vars and put into config.json
- make contract owners same as proxy admin owner, in practice proxy admin owner will be gnosis safe and we want that same contract to have ownership of contracts
- Pass weth to deposit manager initialization
- Deploy handler contract and remove vault
- Add subtree batch fillers args to `NocturneDeployArgs` and give them permission in `deployNocturne`
- Now deploys deposit manager and connects deposit manager to wallet (+ related checks)
- De-classify `NocturneDeployer` into just functions
- Move proxy types to `config` package and import `config`
- Clean up module hierarchy, remove unnecessary exports, and make exports explicit
- Add `tx.wait()` of configured confirmations after each tx
- Start `deploy` package
