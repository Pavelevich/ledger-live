import type { AccountBridge, CurrencyBridge } from "@ledgerhq/types-live";
import type { GetAddressFn } from "@ledgerhq/ledger-wallet-framework/bridge/getAddressWrapper";
import type { SignerContext } from "@ledgerhq/ledger-wallet-framework/signer";
import { getCoinFrameworkCurrencyBridge } from "@ledgerhq/live-common/bridge/generic-coin-framework/currencyBridge";
import { getCoinFrameworkAccountBridge } from "@ledgerhq/live-common/bridge/generic-coin-framework/accountBridge";
import type { GenericTransaction } from "@ledgerhq/live-common/bridge/generic-coin-framework/types";
import stellarGetAddress from "@ledgerhq/live-common/families/stellar/getAddress";
import type { StellarSigner } from "@ledgerhq/live-common/families/stellar/types";
import { registerCoinModules } from "@ledgerhq/live-common/coin-modules/registry";
import { coinModuleLoaders } from "@ledgerhq/live-common/coin-modules/loaders";
import * as signer from "./signer";

registerCoinModules(coinModuleLoaders);

export async function getBridges(): Promise<{
  currencyBridge: CurrencyBridge;
  accountBridge: AccountBridge<GenericTransaction>;
  getAddress: GetAddressFn;
}> {
  // The module namespace `signer` exposes `getPublicKey`, `getAddress` and
  // `signTransaction` as own properties — i.e. exactly the contract the
  // framework's SignerContext callback expects.
  const context: SignerContext<typeof signer> = (_, fn) => fn(signer);
  // `stellarGetAddress` only invokes `signer.getPublicKey`, which our test
  // signer implements identically to the hw-app-str `StellarSigner` shape —
  // the `signTransaction(path, string)` divergence (vs the hw-app-str
  // `signTransaction(path, Buffer)`) is intentional because the generic-
  // coin-framework signOperation passes a base64 string, not a Buffer.
  const getAddress = stellarGetAddress(context as unknown as SignerContext<StellarSigner>);

  return {
    currencyBridge: await getCoinFrameworkCurrencyBridge("stellar", "local", {
      context,
      getAddress,
    }),
    accountBridge: await getCoinFrameworkAccountBridge("stellar", "local", {
      context,
      getAddress,
    }),
    getAddress,
  };
}
