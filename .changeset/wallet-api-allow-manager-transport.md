---
"@ledgerhq/live-common": minor
"ledger-live-desktop": minor
"live-mobile": minor
"@ledgerhq/wallet-api-deeplink-module": patch
"@ledgerhq/wallet-api-exchange-module": patch
"@ledgerhq/wallet-api-feature-flag-module": patch
"@ledgerhq/wallet-api-acre-module": patch
---

Support `allowManager` in wallet-api `device.transport` / `device.select` so wallet apps can request a Manager-ready transport (BOLOS dashboard) and issue Manager APDUs. Bumps `@ledgerhq/wallet-api-*` deps accordingly.

Also fixes an inverted version check in `device.transport` / `device.select` that rejected app versions satisfying `appVersionRange` (and accepted ones that didn't).
