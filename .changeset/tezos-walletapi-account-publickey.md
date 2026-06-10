---
"@ledgerhq/live-common": minor
"@ledgerhq/wallet-api-deeplink-module": patch
"@ledgerhq/wallet-api-feature-flag-module": patch
"@ledgerhq/wallet-api-acre-module": patch
"@ledgerhq/wallet-api-exchange-module": patch
---

Populate the Wallet API account `publicKey` from `seedIdentifier` for account-based families whose `seedIdentifier` is the public key, so dApp flows that need it up front (e.g. `tezos_getAccounts`) can read it.
