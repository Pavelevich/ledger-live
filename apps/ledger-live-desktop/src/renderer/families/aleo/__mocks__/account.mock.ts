import BigNumber from "bignumber.js";
import type { AleoTokenAccount } from "@ledgerhq/live-common/families/aleo/types";
import type { Account } from "@ledgerhq/types-live";
import { genAccount } from "@ledgerhq/ledger-wallet-framework/mocks/account";
import { aleoCurrency } from "./currency.mock";

export const ALEO_ACCOUNT_1 = { ...genAccount("aleo-1", { currency: aleoCurrency }), index: 0 };
export const ALEO_ACCOUNT_2 = { ...genAccount("aleo-2", { currency: aleoCurrency }), index: 1 };
export const ALEO_ACCOUNT_3 = { ...genAccount("aleo-3", { currency: aleoCurrency }), index: 2 };
export const makeAleoTokenAccount = (
  overrides?: Partial<AleoTokenAccount>,
): AleoTokenAccount =>
  ({
    ...ALEO_ACCOUNT_1,
    type: "TokenAccount",
    parentId: ALEO_ACCOUNT_1.id,
    token: {
      type: "TokenCurrency",
      id: "aleo/token",
      parentCurrency: ALEO_ACCOUNT_1.currency,
    },
    ...overrides,
  }) as AleoTokenAccount;

export const NEW_ALEO_ACCOUNT: Account = {
  ...genAccount("aleo-4", { currency: aleoCurrency }),
  balance: new BigNumber(0),
  spendableBalance: new BigNumber(0),
  operations: [],
  operationsCount: 0,
  pendingOperations: [],
  subAccounts: [],
  creationDate: new Date(),
  used: false,
  index: 3,
};
