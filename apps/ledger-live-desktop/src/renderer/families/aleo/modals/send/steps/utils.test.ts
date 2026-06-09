import BigNumber from "bignumber.js";
import type { AleoAccount } from "@ledgerhq/live-common/families/aleo/types";
import type { AccountLike } from "@ledgerhq/types-live";
import { ALEO_ACCOUNT_1, makeAleoTokenAccount } from "../../../__mocks__/account.mock";
import { makeAleoTransaction } from "../../../__mocks__/transaction.mock";
import { isAleoAccount, isAleoTransaction } from "./utils";

describe("isAleoAccount", () => {
  it("should return true for an Aleo main account", () => {
    const aleoAccount: AleoAccount = {
      ...ALEO_ACCOUNT_1,
      aleoResources: {
        transparentBalance: new BigNumber(0),
        privateBalance: new BigNumber(0),
        unspentPrivateRecords: [],
        provableApi: null,
        lastPrivateSyncDate: null,
      },
    };

    expect(isAleoAccount(aleoAccount)).toBe(true);
  });

  it("should return true for an Aleo token account", () => {
    const tokenAccount = makeAleoTokenAccount() as unknown as AccountLike;

    expect(isAleoAccount(tokenAccount)).toBe(true);
  });

  it("should return false for a non-Aleo account", () => {
    const plainAccount: AccountLike = {
      ...ALEO_ACCOUNT_1,
      currency: { ...ALEO_ACCOUNT_1.currency, family: "bitcoin" },
    };

    expect(isAleoAccount(plainAccount)).toBe(false);
  });
});

describe("isAleoTransaction", () => {
  it("should return true for an aleo transaction", () => {
    expect(isAleoTransaction(makeAleoTransaction())).toBe(true);
  });

  it("should return false for a non-aleo transaction", () => {
    expect(
      // @ts-expect-error - testing invalid family
      isAleoTransaction({ ...makeAleoTransaction(), family: "bitcoin" }),
    ).toBe(false);
  });
});
