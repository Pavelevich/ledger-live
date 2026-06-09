---
"live-mobile": minor
"@ledgerhq/live-common": minor
"@ledgerhq/live-signer-evm": patch
"@ledgerhq/live-dmk-speculos": patch
"ledger-live-mobile-e2e-tests": minor
---

tests(e2e): add detox for evm native staking (sei_evm) and mock smoke under `apps/ledger-live-mobile/e2e` and Speculos delegate flow under `e2e/mobile`
Fix EVM clear signing on Speculos (e.g. SEI native staking delegate) failing with `EthAppPleaseEnableContractData` (APDU `6a80`). The DMK context module was always querying the CAL in `prod` mode, so Speculos devices (which only trust test-signed clear-signing descriptors and PKI certificates) rejected the clear-signing context and fell back to blind signing. `DmkSignerEth` now accepts an optional `calMode`, and the EVM signer forces CAL `test` mode when signing against a Speculos transport (detected via a marker, no production impact).

