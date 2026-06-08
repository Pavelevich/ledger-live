import type { AccountBridge, CurrencyBridge } from "@ledgerhq/types-live";
import type { GetAddressFn } from "@ledgerhq/ledger-wallet-framework/bridge/getAddressWrapper";
import type { SignerContext } from "@ledgerhq/ledger-wallet-framework/signer";
import { getCoinFrameworkCurrencyBridge } from "@ledgerhq/live-common/bridge/generic-coin-framework/currencyBridge";
import { getCoinFrameworkAccountBridge } from "@ledgerhq/live-common/bridge/generic-coin-framework/accountBridge";
import type { GenericTransaction } from "@ledgerhq/live-common/bridge/generic-coin-framework/types";
import xrpResolver from "@ledgerhq/live-common/families/xrp/getAddress";
import type { XrpSigner } from "@ledgerhq/live-common/families/xrp/types";
import { registerCoinModules } from "@ledgerhq/live-common/coin-modules/registry";
import { coinModuleLoaders } from "@ledgerhq/live-common/coin-modules/loaders";
import * as xrpUtils from "@ledgerhq/coin-xrp/utils/index";
import { getAccountInfo } from "@ledgerhq/coin-xrp/network/index";

registerCoinModules(coinModuleLoaders);

const NETWORK = "ripple";

/**
 * Replace `@ledgerhq/coin-xrp`'s 10 s recipient cache with a passthrough
 * that re-queries `account_info` on every call. Without this, sub-reserve
 * sends to a freshly-created recipient would have to wait the cache TTL
 * before the bridge stops marking the recipient as new.
 *
 * `validateIntent` reads `utils.cachedRecipientIsNew` via a property
 * access on the module exports at call time, so reassigning the property
 * propagates to every caller. In real LLD/LLM usage the cache is
 * invisible because UI pacing exceeds the TTL, so this patch is test-only.
 */
export function bypassCoinXrpRecipientCache(): void {
  (xrpUtils as { cachedRecipientIsNew: (r: string) => Promise<boolean> }).cachedRecipientIsNew =
    async recipient => (await getAccountInfo(recipient)).isNewAccount;
}

export async function getBridges(signer: XrpSigner): Promise<{
  currencyBridge: CurrencyBridge;
  accountBridge: AccountBridge<GenericTransaction>;
  getAddress: GetAddressFn;
}> {
  const context: SignerContext<XrpSigner> = (_, fn) => fn(signer);
  const getAddress = xrpResolver(context);

  return {
    currencyBridge: await getCoinFrameworkCurrencyBridge(NETWORK, "local", { context, getAddress }),
    accountBridge: await getCoinFrameworkAccountBridge(NETWORK, "local", { context, getAddress }),
    getAddress,
  };
}
