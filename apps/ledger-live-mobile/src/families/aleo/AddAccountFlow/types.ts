import type { Account } from "@ledgerhq/types-live";
import type { CryptoOrTokenCurrency } from "@ledgerhq/types-cryptoassets";
import type { Device } from "@ledgerhq/types-devices";
import { ScreenName } from "~/const";
import type { AddAccountContextType } from "LLM/features/Accounts/screens/AddAccount/types";

type AleoAddAccountCommonParams = {
  currency: CryptoOrTokenCurrency;
  device: Device;
  context?: AddAccountContextType;
  onCloseNavigation?: () => void;
  navigationDepth?: number;
  inline?: boolean;
  returnToSwap?: boolean;
  onSuccess?: (res: { scannedAccounts: Account[]; selected: Account[] }) => void;
};

// Shared params for the entire Aleo add-account flow
export type AleoAddAccountParams = AleoAddAccountCommonParams & {
  accountsToAdd?: Account[];
  initialRoute?:
    | ScreenName.AleoViewKeyWarning
    | ScreenName.AleoViewKeyApprove
    | ScreenName.AleoViewKeyRejected;
};

// Entry point registered in AddAccountsNavigator (outer navigator)
export type AleoAddAccountParamList = {
  [ScreenName.AleoAddAccount]: AleoAddAccountParams;
};

// Internal screens of the AddAccountNavigator sub-navigator
export type AleoViewKeyFlowParamList = {
  [ScreenName.AleoViewKeyWarning]: AleoAddAccountParams;
  [ScreenName.AleoViewKeyApprove]: AleoAddAccountParams & {
    accountsToAdd: Account[];
  };
  [ScreenName.AleoViewKeyRejected]: AleoAddAccountParams;
};
