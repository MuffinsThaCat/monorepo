# Changelog

### Unreleased

- update imports with SDK renames (see SDK changelog)
- Fix bug where bundler endpoint was not being passed in playground ABIForm
- Fix actions display and display correct target addr per action
- add styles for `TxModal`
- Fix unwrap / spend amounts in `index.tsx`
- Add tx modal to `playground.tsx`
- Fix solidity array input bug (misinterpreted as string)
- Redo UI background and cards
- Add `DepositForm` to power user site and have `NocturneFrontendSDK` take wallet and vault addresses
- Add genAndSubmitProofs button
- Add back old test site
- Add bundler endpoint to cofig
- Remove unused wallet contract connect methods from metamask.ts
- Fix regression with dev script not updating token address
- Clean up power user site
  - Add autosyncing display for wallet balances
  - Clean up form sizing and spacing
  - Change displays for enqueued actions and tokens to use nicer list
  - Make ABI form display selector for method names and only display input boxes for selected method
- Remove cross-env
- add ABI form
- Instantiate local prover on page load with `useEffect`
- Import `frontend-sdk` for calling snap and remove all snap utils
- Rename all "flax" instances to "nocturne"
- Change package version to `-alpha`
- `ffjavascript` resolution removed, so proof gen works now
- Proof generation is broken due to yarn workspace incompatibilities with ffjavascript fork (to fix in next PR)
- Start `site` package and expose ability to sync notes, sync leaves, and generate proof for a hardcoded operation request