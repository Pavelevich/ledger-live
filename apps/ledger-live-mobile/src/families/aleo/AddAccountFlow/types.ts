import type { Account } from "@ledgerhq/types-live";
import type { CryptoOrTokenCurrency } from "@ledgerhq/types-cryptoassets";
import type { Device } from "@ledgerhq/types-devices";
import { ScreenName } from "~/const";

// Shared params for the entire Aleo add-account flow
type AleoOnboardParams = {
  accountsToAdd: Account[];
  currency: CryptoOrTokenCurrency;
  device: Device;
};

// Entry point registered in AddAccountsNavigator (outer navigator)
export type AleoOnboardAccountParamList = {
  [ScreenName.AleoOnboardAccount]: AleoOnboardParams;
};

// Internal screens of the AleoAddAccountNavigator sub-navigator
export type AleoViewKeyFlowParamList = {
  [ScreenName.AleoViewKeyWarning]: AleoOnboardParams;
  [ScreenName.AleoViewKeyApprove]: AleoOnboardParams;
};
