/**
 * Solana (native staking) earn deposit/withdraw pipeline.
 *
 * The `earn deposit` / `earn withdraw` commands dispatch here for the `solana` family. We reuse
 * the native Solana staking transaction modes through the bridge (see buildSolanaTransactionModel
 * in ../compatibility/bridge.ts), exactly the way `send.ts` runs a Solana intent:
 *   deposit:  Solana intent `mode: stake.createAccount` (+delegate) with `--product` = validator.
 *             coin-solana's stake.createAccount creates AND delegates a stake account in one tx.
 *   withdraw: two-phase on Solana —
 *             1. `mode: stake.undelegate` (deactivate) by default; the lamports stay locked until
 *                the deactivation epoch boundary passes (typically the next epoch, ~2-3 days).
 *             2. `mode: stake.withdraw` once `--finalize` is passed, moving the now-inactive
 *                lamports back to the main account.
 *
 * Device + dry-run handling mirrors `send.ts`'s runLiveSend / runDryRunSend: the pipeline owns the
 * device session via `withCurrencyDeviceSession(descriptor.currencyId, …)` and resolves the device
 * model with `getWalletCliDeviceModelId()` INSIDE that session before calling `wallet.send`. Native
 * Solana-app clear signing — no plugin/CAL dependency.
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
import type { WalletAdapter } from "../index";
import type { AccountDescriptor } from "../models";
import { SolanaTransactionIntentSchema } from "../intents";
import type { TransactionIntent } from "../intents";
import type { CommandOutput } from "../../output";
import type { EarnDepositResult, EarnTransaction, EarnWithdrawResult } from "./types";

/**
 * Device handles required to sign+broadcast Solana transactions.
 *
 * The pipeline owns the device session (mirroring `send`'s runLiveSend): open it via
 * `withCurrencyDeviceSession(descriptor.currencyId, …)` and resolve the device model with
 * `getWalletCliDeviceModelId()` INSIDE that session before calling `wallet.send`.
 */
export type EarnSolanaDeviceContext = {
  /** live-common device id (e.g. WALLET_CLI_DMK_DEVICE_ID). */
  deviceId: string;
  /** Manager app name to open before signing (e.g. "Solana"). */
  managerAppName: string;
  /** Max time (ms) to wait for the device to unlock/confirm. */
  deviceTimeoutMs?: number;
};

/** Parameters for a Solana native staking deposit (create + delegate). */
export type DepositSolanaParams = {
  /** Resolved source account (the Solana account funding the stake). */
  descriptor: AccountDescriptor;
  /** Canonical network string, e.g. "solana:main". */
  network: string;
  /** Validator vote account address to delegate to (the `--product` value for SOL). */
  validator: string;
  /** Human stake amount, e.g. "1.5 SOL". */
  amount: string;
  /** When true, prepare/validate only — never sign or broadcast. */
  dryRun: boolean;
  /** Wallet adapter used to build/sign/broadcast Solana intents. */
  wallet: WalletAdapter;
  /** Output sink for progress + final result. */
  out: CommandOutput;
  /** Device context. Omitted only when `dryRun` is true. */
  device?: EarnSolanaDeviceContext;
};

/** Parameters for a Solana native staking withdrawal (undelegate / finalize withdraw). */
export type WithdrawSolanaParams = {
  /** Resolved source account (the Solana account that owns the stake account). */
  descriptor: AccountDescriptor;
  /** Canonical network string, e.g. "solana:main". */
  network: string;
  /** Stake account address to undelegate / withdraw from. */
  stakeAccount: string;
  /** Human amount, when partial withdrawals are supported; omitted for full withdraw. */
  amount?: string;
  /**
   * Two-phase control:
   *   false (default) -> `stake.undelegate` (deactivate).
   *   true            -> `stake.withdraw` (move lamports back, after deactivation epoch).
   */
  finalize: boolean;
  /** When true, prepare/validate only — never sign or broadcast. */
  dryRun: boolean;
  /** Wallet adapter used to build/sign/broadcast Solana intents. */
  wallet: WalletAdapter;
  /** Output sink for progress + final result. */
  out: CommandOutput;
  /** Device context. Omitted only when `dryRun` is true. */
  device?: EarnSolanaDeviceContext;
};

/** coin-solana ignores `tx.recipient` for every stake.* mode (it routes on model.kind). */
const STAKE_RECIPIENT = "";

/**
 * Run one Solana stake intent through the wallet adapter, honouring dry-run.
 *
 * dry-run  -> `wallet.prepareSend` (sync + build + validate, no device); returns a "dry-run" step.
 * live     -> open the Solana device session and `wallet.send`; returns a "broadcasted" step with
 *             the broadcast hash, streaming progress to `out` exactly like `send.ts`.
 */
async function runSolanaStakeIntent(params: {
  wallet: WalletAdapter;
  descriptor: AccountDescriptor;
  intent: TransactionIntent;
  kind: string;
  dryRun: boolean;
  device?: EarnSolanaDeviceContext;
  out: CommandOutput;
}): Promise<EarnTransaction> {
  const { wallet, descriptor, intent, kind, dryRun, device, out } = params;

  if (dryRun) {
    const spin = out.spin("Preparing transaction (dry run)…");
    const prepared = await wallet.prepareSend(descriptor, intent);
    spin?.success("Dry run complete (transaction not broadcasted)");
    out.sendDryRun(prepared);
    return { kind, status: "dry-run" };
  }

  if (!device) {
    throw new Error("Device context is required to sign a Solana stake transaction.");
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

  return { kind, hash: txHash, status: "broadcasted" };
}

/** Build a "0 <TICKER>" amount string for stake modes that ignore the tx amount. */
function zeroAmount(currencyId: string): string {
  return `0 ${getCryptoCurrencyById(currencyId).ticker}`;
}

/**
 * Stake (create + delegate) via native Solana staking.
 *
 * Builds a `stake.createAccount` intent for the requested validator. coin-solana's
 * stake.createAccount creates the stake account and delegates it to the validator in a single
 * transaction, so no separate delegate step is required.
 */
export async function depositSolana(params: DepositSolanaParams): Promise<EarnDepositResult> {
  const { descriptor, network, validator, amount, dryRun, wallet, out, device } = params;

  if (!validator) {
    throw new Error(
      "Solana deposit requires a validator vote account address via --product <validator>.",
    );
  }

  const intent = SolanaTransactionIntentSchema.parse({
    family: "solana",
    recipient: STAKE_RECIPIENT,
    amount,
    mode: "stake.createAccount",
    validator,
  });

  const tx = await runSolanaStakeIntent({
    wallet,
    descriptor,
    intent,
    kind: "stake.createAccount",
    dryRun,
    device,
    out,
  });

  return {
    family: "solana",
    account: descriptor.id,
    network,
    amount,
    product: validator,
    validator,
    dryRun,
    status: dryRun ? "dry-run" : "broadcasted",
    transactions: [tx],
  };
}

/**
 * Unstake via native Solana staking — two-phase.
 *
 * Default (no --finalize): `stake.undelegate` deactivates the stake account. The lamports remain
 * locked until the deactivation epoch boundary passes (typically the next epoch).
 *
 * With --finalize: `stake.withdraw` moves the now-inactive lamports back to the main account.
 * coin-solana derives the withdrawable amount on-chain, so the full inactive balance is withdrawn
 * regardless of `--amount`.
 */
export async function withdrawSolana(params: WithdrawSolanaParams): Promise<EarnWithdrawResult> {
  const { descriptor, network, stakeAccount, amount, finalize, dryRun, wallet, out, device } =
    params;

  if (!stakeAccount) {
    throw new Error("Solana withdraw requires the stake account address via --stake-account.");
  }

  const mode = finalize ? "stake.withdraw" : "stake.undelegate";

  const intent = SolanaTransactionIntentSchema.parse({
    family: "solana",
    recipient: STAKE_RECIPIENT,
    // undelegate/withdraw ignore the tx amount (coin-solana computes it on-chain); pass a valid
    // placeholder when the user did not provide one so the intent schema accepts it.
    amount: amount ?? zeroAmount(descriptor.currencyId),
    mode,
    stakeAccount,
  });

  const tx = await runSolanaStakeIntent({
    wallet,
    descriptor,
    intent,
    kind: mode,
    dryRun,
    device,
    out,
  });

  return {
    family: "solana",
    account: descriptor.id,
    network,
    ...(amount === undefined ? {} : { amount }),
    stakeAccount,
    finalize,
    dryRun,
    status: dryRun ? "dry-run" : "broadcasted",
    transactions: [tx],
  };
}
