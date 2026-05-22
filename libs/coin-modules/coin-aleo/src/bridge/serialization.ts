import BigNumber from "bignumber.js";
import type { AccountRaw, Account } from "@ledgerhq/types-live";
import type { AleoAccount, AleoAccountRaw, AleoResources, AleoResourcesRaw } from "../types";
import type { AleoPrivateRecord } from "../types/api";

export function toAleoResourcesRaw(resources: AleoResources): AleoResourcesRaw {
  return {
    transparentBalance: resources.transparentBalance.toString(),
    privateBalance: resources.privateBalance?.toString() ?? null,
    provableApi: resources.provableApi ? JSON.stringify(resources.provableApi) : null,
    lastPrivateSyncDate: resources.lastPrivateSyncDate
      ? resources.lastPrivateSyncDate.toISOString()
      : null,
    unspentPrivateRecords: resources.unspentPrivateRecords
      ? JSON.stringify(resources.unspentPrivateRecords)
      : null,
    privateTokenBalances: resources.privateTokenBalances
      ? JSON.stringify(
          resources.privateTokenBalances.map(entry => ({
            id: entry.id,
            contractAddress: entry.contractAddress,
            balance: entry.balance.toString(),
            unspentRecords: entry.unspentRecords,
          })),
        )
      : null,
    ...(resources.hasMigratedPublicTokens !== undefined && {
      hasMigratedPublicTokens: resources.hasMigratedPublicTokens,
    }),
    ...(resources.hasMigratedPrivateTokens !== undefined && {
      hasMigratedPrivateTokens: resources.hasMigratedPrivateTokens,
    }),
  };
}

export function fromAleoResourcesRaw(rawResources: AleoResourcesRaw): AleoResources {
  return {
    transparentBalance: new BigNumber(rawResources.transparentBalance),
    privateBalance: rawResources.privateBalance ? new BigNumber(rawResources.privateBalance) : null,
    provableApi: rawResources.provableApi ? JSON.parse(rawResources.provableApi) : null,
    lastPrivateSyncDate: rawResources.lastPrivateSyncDate
      ? new Date(rawResources.lastPrivateSyncDate)
      : null,
    unspentPrivateRecords: rawResources.unspentPrivateRecords
      ? JSON.parse(rawResources.unspentPrivateRecords)
      : null,
    privateTokenBalances: rawResources.privateTokenBalances
      ? JSON.parse(rawResources.privateTokenBalances).map(
          (entry: {
            id: string;
            contractAddress: string;
            balance: string;
            unspentRecords: AleoPrivateRecord[];
          }) => ({
            id: entry.id,
            contractAddress: entry.contractAddress,
            balance: new BigNumber(entry.balance),
            unspentRecords: entry.unspentRecords,
          }),
        )
      : null,
    ...(rawResources.hasMigratedPublicTokens !== undefined && {
      hasMigratedPublicTokens: rawResources.hasMigratedPublicTokens,
    }),
    ...(rawResources.hasMigratedPrivateTokens !== undefined && {
      hasMigratedPrivateTokens: rawResources.hasMigratedPrivateTokens,
    }),
  };
}

export function assignToAccountRaw(account: Account, accountRaw: AccountRaw): void {
  const aleoAccount = account as AleoAccount;
  const aleoAccountRaw = accountRaw as AleoAccountRaw;

  if (aleoAccount.aleoResources) {
    aleoAccountRaw.aleoResources = toAleoResourcesRaw(aleoAccount.aleoResources);
  }
}

export function assignFromAccountRaw(accountRaw: AccountRaw, account: Account) {
  const aleoAccount = account as AleoAccount;
  const aleoAccountRaw = accountRaw as AleoAccountRaw;

  if (aleoAccountRaw.aleoResources) {
    aleoAccount.aleoResources = fromAleoResourcesRaw(aleoAccountRaw.aleoResources);
  }
}
