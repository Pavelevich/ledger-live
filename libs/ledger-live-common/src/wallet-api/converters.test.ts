import { Account } from "@ledgerhq/types-live";
import { getCryptoCurrencyById } from "@ledgerhq/cryptoassets";
import { initialState as walletState } from "@ledgerhq/live-wallet/store";
import BigNumber from "bignumber.js";
import "../__tests__/test-helpers/setup";
import type { Transaction } from "../coin-modules/transaction-types";
import { accountToWalletAPIAccount, getWalletAPITransactionSignFlowInfos } from "./converters";
import type { WalletAPITransaction } from "./types";

const evmBridge = jest.fn();
const bitcoinBridge = jest.fn();
jest.mock("../coin-modules/registry", () => ({
  loadWalletApiAdapterForFamily: (family: string) => {
    switch (family) {
      case "evm":
        return { getWalletAPITransactionSignFlowInfos: () => evmBridge() };
      case "bitcoin":
        return { getWalletAPITransactionSignFlowInfos: () => bitcoinBridge() };
      default:
        return undefined;
    }
  },
}));

describe("getWalletAPITransactionSignFlowInfos", () => {
  beforeEach(() => {
    evmBridge.mockClear();
    bitcoinBridge.mockClear();
  });

  it("should call the bridge if the implementation exists", async () => {
    // Given
    const tx: WalletAPITransaction = {
      family: "bitcoin",
      amount: new BigNumber(100000),
      recipient: "0xABCDEF",
    };

    // When
    await getWalletAPITransactionSignFlowInfos({
      walletApiTransaction: tx,
      account: {} as Account,
    });

    // Then
    expect(bitcoinBridge).toHaveBeenCalledTimes(1);
    expect(evmBridge).toHaveBeenCalledTimes(0);
  });

  it("should call the evm bridge for WalletAPITransaction tx of ethereum family", async () => {
    // Given
    const tx: WalletAPITransaction = {
      family: "ethereum",
      amount: new BigNumber(100000),
      recipient: "0xABCDEF",
    };

    // When
    await getWalletAPITransactionSignFlowInfos({
      walletApiTransaction: tx,
      account: {} as Account,
    });

    // Then
    expect(evmBridge).toHaveBeenCalledTimes(1);
    expect(bitcoinBridge).toHaveBeenCalledTimes(0);
  });

  it("should use its fallback if the bridge doesn't exist", async () => {
    // Given
    const tx: WalletAPITransaction = {
      family: "algorand",
      mode: "send",
      amount: new BigNumber(100000),
      recipient: "0xABCDEF",
    };

    const expectedLiveTx: Partial<Transaction> = {
      family: tx.family,
      mode: "send",
      amount: tx.amount,
      recipient: tx.recipient,
    };

    // When
    const { canEditFees, hasFeesProvided, liveTx } = await getWalletAPITransactionSignFlowInfos({
      walletApiTransaction: tx,
      account: {} as Account,
    });

    // Then
    expect(evmBridge).toHaveBeenCalledTimes(0);
    expect(bitcoinBridge).toHaveBeenCalledTimes(0);
    expect(canEditFees).toBe(false);
    expect(hasFeesProvided).toBe(false);
    expect(liveTx).toEqual(expectedLiveTx);
  });
});

describe("accountToWalletAPIAccount", () => {
  const makeAccount = (currencyId: string, seedIdentifier: string): Account =>
    ({
      type: "Account",
      id: `js:2:${currencyId}:addr:`,
      index: 0,
      seedIdentifier,
      freshAddress: "addr",
      currency: getCryptoCurrencyById(currencyId),
      balance: new BigNumber(0),
      spendableBalance: new BigNumber(0),
      blockHeight: 0,
      lastSyncDate: new Date(0),
    }) as unknown as Account;

  it("exposes publicKey from seedIdentifier for families whose seedIdentifier is the public key (tezos)", () => {
    const result = accountToWalletAPIAccount(walletState, makeAccount("tezos", "edpkSeed"));
    expect(result.publicKey).toBe("edpkSeed");
  });

  it("omits publicKey for families where seedIdentifier is not a public key (bitcoin)", () => {
    const result = accountToWalletAPIAccount(walletState, makeAccount("bitcoin", "xpub-seed"));
    expect(result).not.toHaveProperty("publicKey");
  });

  it("omits publicKey for an allowlisted family with an empty seedIdentifier", () => {
    const result = accountToWalletAPIAccount(walletState, makeAccount("tezos", ""));
    expect(result).not.toHaveProperty("publicKey");
  });
});
