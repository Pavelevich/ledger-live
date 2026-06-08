/**
 * ETH (EVM) earn deposit/withdraw pipeline.
 *
 * The `earn deposit` / `earn withdraw` commands dispatch here for the `evm` family. Vaults are
 * resolved from GET /v1/defi/products, which acts as the trusted allowlist. Backend-built calldata
 * is passed through the regular EVM bridge intent and then into bridge.signOperation.
 *
 * Clear signing relies on the Ethereum app and CAL descriptors for ERC-20 approve and Kiln vault
 * calls; manual QA on device is required to verify the displayed screens.
 *
 * Do NOT change the exported signatures without coordinating with the earn commands — they are the
 * integration contract.
 */

import { getCryptoCurrencyById } from "@ledgerhq/live-common/currencies/index";
import { getWalletCliDeviceModelId } from "../../device/register-dmk-transport";
import { WalletCliDeviceError } from "../../device/wallet-cli-device-error";
import { withCurrencyDeviceSession } from "../../session/bridge-device-session";
import { runObservable } from "../../commands/run-observable";
import { colors } from "../../shared/ui";
import {
  getDefiProducts,
  getEthTxStatus,
  postDefiApprove,
  postDefiDeposit,
  postDefiWithdraw,
} from "../../api/earn-api";
import type { DefiProduct, DefiTransactionData, EthTxStatus } from "../../api/earn-api.types";
import type { WalletAdapter } from "../index";
import type { AccountDescriptor } from "../models";
import { EvmTransactionIntentSchema } from "../intents";
import type { TransactionIntent } from "../intents";
import type { CommandOutput } from "../../output";
import type { EarnDepositResult, EarnTransaction, EarnWithdrawResult } from "./types";

/**
 * Device handles required to sign+broadcast EVM transactions.
 *
 * The pipeline owns the device session (mirroring `send`'s runLiveSend): open it via
 * `withCurrencyDeviceSession(descriptor.currencyId, …)` and resolve the device model with
 * `getWalletCliDeviceModelId()` INSIDE that session before calling `wallet.send`.
 */
export type EarnDeviceContext = {
  /** live-common device id (e.g. WALLET_CLI_DMK_DEVICE_ID). */
  deviceId: string;
  /** Manager app name to open before signing (e.g. "Ethereum"). */
  managerAppName: string;
  /** Max time (ms) to wait for the device to unlock/confirm. */
  deviceTimeoutMs?: number;
};

/** Parameters for an EVM vault deposit. */
export type DepositEvmParams = {
  /** Resolved source account (the EVM account funding the deposit). */
  descriptor: AccountDescriptor;
  /** Canonical network string, e.g. "ethereum:main". */
  network: string;
  /** Vault id from GET /v1/defi/products (the trusted-vault allowlist key). */
  productId: string;
  /** Human deposit amount including/excluding ticker as accepted by the command. */
  amount: string;
  /** When true, prepare/validate only — never sign or broadcast. */
  dryRun: boolean;
  /** Wallet adapter used to build/sign/broadcast EVM intents. */
  wallet: WalletAdapter;
  /** Output sink for progress + final result. */
  out: CommandOutput;
  /** Device context. Omitted only when `dryRun` is true. */
  device?: EarnDeviceContext;
};

/** Parameters for an EVM vault withdrawal (redeem). */
export type WithdrawEvmParams = {
  /** Resolved source account (the EVM account that owns the vault shares). */
  descriptor: AccountDescriptor;
  /** Canonical network string, e.g. "ethereum:main". */
  network: string;
  /** Vault id from GET /v1/defi/products. */
  productId: string;
  /** Human amount to withdraw; when omitted the full share balance is redeemed. */
  amount?: string;
  /** When true, prepare/validate only — never sign or broadcast. */
  dryRun: boolean;
  /** Wallet adapter used to build/sign/broadcast EVM intents. */
  wallet: WalletAdapter;
  /** Output sink for progress + final result. */
  out: CommandOutput;
  /** Device context. Omitted only when `dryRun` is true. */
  device?: EarnDeviceContext;
};

const APPROVE_POLL_ATTEMPTS = 12;
const APPROVE_POLL_INTERVAL_MS = 5_000;
const TX_STATUS_POLL_ATTEMPTS = 30;
const TX_STATUS_POLL_INTERVAL_MS = 5_000;

const TERMINAL_TX_STATUSES = new Set<EthTxStatus>(["success", "error"]);
const PENDING_TX_STATUSES = new Set<EthTxStatus>(["pending_confirmation", "unknown"]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function productMatchKeys(product: DefiProduct): string[] {
  return [product.id, product.vault_id, product.address, product.vault].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
}

export function resolveDefiProduct(
  products: readonly DefiProduct[],
  productId: string,
): DefiProduct {
  const needle = normalize(productId);
  const product = products.find(candidate =>
    productMatchKeys(candidate).some(value => normalize(value) === needle),
  );
  if (!product) {
    throw new Error(
      `Unknown EVM earn product "${productId}". Use a product id, vault_id, address, or vault returned by earn yields/products.`,
    );
  }
  return product;
}

function requireProductString(product: DefiProduct, key: keyof DefiProduct): string {
  const value = product[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Defi product ${product.id} is missing required field "${String(key)}".`);
  }
  return value;
}

function requireProductNumber(product: DefiProduct, key: keyof DefiProduct): number {
  const value = product[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(
      `Defi product ${product.id} is missing required integer field "${String(key)}".`,
    );
  }
  return value;
}

function vaultAddress(product: DefiProduct): string {
  return requireProductString(product, "vault");
}

function accountAddress(descriptor: AccountDescriptor): string {
  const address = descriptor.freshAddress || descriptor.seedIdentifier;
  if (!address) {
    throw new Error(
      "Could not determine the EVM wallet address from the account descriptor. Re-discover the account before using earn.",
    );
  }
  return address;
}

function extractHumanAmount(input: string): string {
  const trimmed = input.trim();
  if (/^[+-]?\d+(?:\.\d+)?e[+-]?\d+$/i.test(trimmed)) {
    throw new Error(`Invalid amount "${input}". Expected a positive decimal amount.`);
  }
  const match =
    trimmed.match(/^(\d+(?:\.\d+)?)\s*[A-Za-z][A-Za-z0-9._-]*$/) ??
    trimmed.match(/^[A-Za-z][A-Za-z0-9._-]*\s*(\d+(?:\.\d+)?)$/) ??
    trimmed.match(/^(\d+(?:\.\d+)?)$/);
  if (!match) {
    throw new Error(`Invalid amount "${input}". Expected a positive decimal amount.`);
  }
  return match[1];
}

export function parseAmountToBaseUnits(input: string, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid asset decimals: ${decimals}.`);
  }
  const amount = extractHumanAmount(input);
  const [whole, fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw new Error(
      `Amount "${input}" has too many decimal places for an asset with ${decimals} decimals.`,
    );
  }
  const paddedFraction = fraction.padEnd(decimals, "0");
  const baseUnits = `${whole}${paddedFraction}`.replace(/^0+(?=\d)/, "");
  return baseUnits || "0";
}

export function assertTransactionTarget(
  tx: DefiTransactionData,
  expectedTo: string,
  step: string,
): void {
  if (normalize(tx.to) !== normalize(expectedTo)) {
    throw new Error(
      `Refusing to sign ${step}: backend transaction target ${tx.to} does not match allowlisted target ${expectedTo}.`,
    );
  }
}

function zeroNativeAmount(currencyId: string): string {
  return `0 ${getCryptoCurrencyById(currencyId).ticker}`;
}

function buildEvmIntent(descriptor: AccountDescriptor, tx: DefiTransactionData): TransactionIntent {
  return EvmTransactionIntentSchema.parse({
    family: "evm",
    recipient: tx.to,
    amount: zeroNativeAmount(descriptor.currencyId),
    data: tx.data,
  });
}

async function runEvmVaultIntent(params: {
  wallet: WalletAdapter;
  descriptor: AccountDescriptor;
  tx: DefiTransactionData;
  kind: string;
  dryRun: boolean;
  device?: EarnDeviceContext;
  out: CommandOutput;
}): Promise<EarnTransaction> {
  const { wallet, descriptor, tx, kind, dryRun, device, out } = params;
  const intent = buildEvmIntent(descriptor, tx);

  if (dryRun) {
    const spin = out.spin("Preparing transaction (dry run)…");
    const prepared = await wallet.prepareSend(descriptor, intent);
    spin?.success("Dry run complete (transaction not broadcasted)");
    out.sendDryRun(prepared);
    return { kind, to: tx.to, status: "dry-run" };
  }

  if (!device) {
    throw new Error("Device context is required to sign an EVM earn transaction.");
  }
  const { deviceId, managerAppName, deviceTimeoutMs } = device;

  let txHash: string | undefined;
  out.spin(`Connect device and open ${colors.bold(managerAppName)} app…`);
  await withCurrencyDeviceSession(
    descriptor.currencyId,
    async () => {
      out.spin(`Preparing ${colors.bold(managerAppName)} transaction…`);

      const deviceModelId = await getWalletCliDeviceModelId();
      if (deviceModelId === undefined) {
        throw new Error(
          "Could not determine device model from the active session. Disconnect and reconnect the device.",
        );
      }

      await runObservable({
        source$: wallet.send(descriptor, intent, { deviceId, deviceModelId }),
        onNext: event => {
          if (event.type === "broadcasted") txHash = event.txHash;
          out.sendEvent(event);
        },
        mapError: error =>
          WalletCliDeviceError.fromKnownDeviceError(error, {
            expectedApp: managerAppName,
            rejectedContext: "sign",
          }) ?? error,
      });

      out.sendComplete();
    },
    {
      deviceTimeoutMs,
      onStateChange: state => out.deviceState(state),
    },
  );

  if (!txHash) {
    throw new Error(`EVM ${kind} transaction was signed but no broadcast hash was returned.`);
  }
  return { kind, hash: txHash, to: tx.to, status: "broadcasted" };
}

async function pollEthTransactionStatus(txHash: string): Promise<EthTxStatus> {
  let lastStatus: EthTxStatus = "unknown";
  for (let attempt = 0; attempt < TX_STATUS_POLL_ATTEMPTS; attempt += 1) {
    const response = await getEthTxStatus({ txHash });
    lastStatus = response.data.status;
    if (TERMINAL_TX_STATUSES.has(lastStatus)) return lastStatus;
    if (!PENDING_TX_STATUSES.has(lastStatus)) return lastStatus;
    if (attempt < TX_STATUS_POLL_ATTEMPTS - 1) await sleep(TX_STATUS_POLL_INTERVAL_MS);
  }
  return lastStatus;
}

async function waitForApproveCompletion(params: {
  request: Parameters<typeof postDefiApprove>[0];
  approveHash: string;
}): Promise<string> {
  const { request, approveHash } = params;
  for (let attempt = 0; attempt < APPROVE_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(APPROVE_POLL_INTERVAL_MS);
    const approve = await postDefiApprove(request);
    if (approve.kind === "no-action") return "approved";
  }

  const status = await pollEthTransactionStatus(approveHash);
  if (status !== "success") {
    throw new Error(
      `Approve transaction ${approveHash} did not reach success (last status: ${status}).`,
    );
  }
  return status;
}

function buildDepositRequest(params: {
  descriptor: AccountDescriptor;
  product: DefiProduct;
  amount: string;
}) {
  const { descriptor, product, amount } = params;
  return {
    wallet: accountAddress(descriptor),
    asset: requireProductString(product, "asset"),
    chain_id: requireProductNumber(product, "chain_id"),
    vault: vaultAddress(product),
    amount,
    ignore_checks: true,
  };
}

function buildWithdrawRequest(params: {
  descriptor: AccountDescriptor;
  product: DefiProduct;
  amount: string;
}) {
  const { descriptor, product, amount } = params;
  return {
    wallet: accountAddress(descriptor),
    chain_id: requireProductNumber(product, "chain_id"),
    vault: vaultAddress(product),
    amount,
    ignore_checks: true,
  };
}

/**
 * Deposit into a Kiln ERC-4626 vault. See module doc for the intended flow.
 */
export async function depositEvm(params: DepositEvmParams): Promise<EarnDepositResult> {
  const { descriptor, network, productId, amount, dryRun, wallet, out, device } = params;
  const product = resolveDefiProduct(await getDefiProducts(), productId);
  const decimals = requireProductNumber(product, "asset_decimals");
  const amountBaseUnits = parseAmountToBaseUnits(amount, decimals);
  const vault = vaultAddress(product);
  const asset = requireProductString(product, "asset");
  const request = buildDepositRequest({ descriptor, product, amount: amountBaseUnits });
  const transactions: EarnTransaction[] = [];

  const approve = await postDefiApprove(request);
  if (approve.kind === "transaction") {
    assertTransactionTarget(approve.data, asset, "approve");
    const approveTx = await runEvmVaultIntent({
      wallet,
      descriptor,
      tx: approve.data,
      kind: "approve",
      dryRun,
      device,
      out,
    });
    if (!dryRun && approveTx.hash) {
      approveTx.status = await waitForApproveCompletion({ request, approveHash: approveTx.hash });
    }
    transactions.push(approveTx);
  }

  const deposit = await postDefiDeposit(request);
  assertTransactionTarget(deposit.data, vault, "deposit");
  const depositTx = await runEvmVaultIntent({
    wallet,
    descriptor,
    tx: deposit.data,
    kind: "deposit",
    dryRun,
    device,
    out,
  });
  if (!dryRun && depositTx.hash) {
    depositTx.status = await pollEthTransactionStatus(depositTx.hash);
  }
  transactions.push(depositTx);

  return {
    family: "evm",
    account: descriptor.id,
    network,
    amount,
    product: product.id,
    dryRun,
    status: dryRun ? "dry-run" : depositTx.status || "broadcasted",
    transactions,
  };
}

/**
 * Withdraw (redeem) from a Kiln ERC-4626 vault. See module doc for the intended flow.
 */
export async function withdrawEvm(params: WithdrawEvmParams): Promise<EarnWithdrawResult> {
  const { descriptor, network, productId, amount, dryRun, wallet, out, device } = params;
  if (amount === undefined) {
    throw new Error(
      "EVM full withdraw is not supported yet: /v1/defi/withdraw requires an amount and wallet-cli does not currently derive the vault share balance. Pass --amount for a partial withdraw.",
    );
  }

  const product = resolveDefiProduct(await getDefiProducts(), productId);
  const decimals = requireProductNumber(product, "asset_decimals");
  const amountBaseUnits = parseAmountToBaseUnits(amount, decimals);
  const request = buildWithdrawRequest({ descriptor, product, amount: amountBaseUnits });
  const withdraw = await postDefiWithdraw(request);
  assertTransactionTarget(withdraw.data, vaultAddress(product), "withdraw");

  const withdrawTx = await runEvmVaultIntent({
    wallet,
    descriptor,
    tx: withdraw.data,
    kind: "redeem",
    dryRun,
    device,
    out,
  });
  if (!dryRun && withdrawTx.hash) {
    withdrawTx.status = await pollEthTransactionStatus(withdrawTx.hash);
  }

  return {
    family: "evm",
    account: descriptor.id,
    network,
    amount,
    product: product.id,
    dryRun,
    status: dryRun ? "dry-run" : withdrawTx.status || "broadcasted",
    transactions: [withdrawTx],
  };
}
