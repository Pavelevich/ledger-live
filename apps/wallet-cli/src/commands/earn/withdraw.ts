import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { getCryptoCurrencyById } from "@ledgerhq/live-common/currencies/index";
import { WALLET_CLI_DMK_DEVICE_ID } from "../../device/register-dmk-transport";
import { getManagerAppNameForCurrencyId } from "../../session/bridge-device-session";
import { networkStringFromCurrencyId } from "../../shared/accountDescriptor";
import { createCommandOutput } from "../../output";
import { WalletAdapter } from "../../wallet";
import { withdrawEvm } from "../../wallet/earn/eth-vault-pipeline";
import { withdrawSolana } from "../../wallet/earn/sol-stake";
import type { EarnWithdrawResult } from "../../wallet/earn/types";
import {
  accountOption,
  deviceTimeoutOption,
  outputOption,
  resolveAccountArg,
  resolveAccountDescriptor,
  resolveOutputFormat,
} from "../inputs";

export default defineCommand({
  name: "withdraw",
  description: "Withdraw from an earn product (ETH vault) or unstake (Solana)",
  options: {
    account: accountOption,
    product: option(z.string().min(1).optional(), {
      description: "ETH vault id to redeem from (required for EVM accounts).",
      short: "p",
    }),
    "stake-account": option(z.string().min(1).optional(), {
      description: "Solana stake account address to undelegate / withdraw from.",
    }),
    amount: option(z.string().min(1).optional(), {
      description: "Amount to withdraw; omit to withdraw the full balance.",
    }),
    finalize: option(z.boolean().default(false), {
      description:
        "Solana unstaking is two-phase: run once to undelegate (deactivate) the stake account, " +
        "wait for the deactivation epoch boundary (~2-3 days), then re-run with --finalize to " +
        "withdraw (stake.withdraw) the inactive lamports back to your main account.",
      argumentKind: "flag",
    }),
    "dry-run": option(z.boolean().default(false), {
      description: "Prepare and validate but do not sign or broadcast",
      argumentKind: "flag",
    }),
    output: outputOption,
    "device-timeout": deviceTimeoutOption,
  },
  handler: async ({ flags, positional }) => {
    const output = resolveOutputFormat(flags.output);
    const ctx = { command: "earn withdraw", network: "", account: "" };
    const out = createCommandOutput(output, ctx);
    const wallet = new WalletAdapter();
    const dryRun = flags["dry-run"];

    await out.run(async () => {
      const descriptor = await resolveAccountDescriptor(
        resolveAccountArg(flags.account, positional),
      );
      const network = networkStringFromCurrencyId(descriptor.currencyId);
      ctx.network = network;
      ctx.account = descriptor.id;

      const { family } = getCryptoCurrencyById(descriptor.currencyId);
      const device = dryRun
        ? undefined
        : {
            deviceId: WALLET_CLI_DMK_DEVICE_ID,
            managerAppName: getManagerAppNameForCurrencyId(descriptor.currencyId),
            deviceTimeoutMs: flags["device-timeout"],
          };

      let result: EarnWithdrawResult;
      switch (family) {
        case "evm": {
          if (!flags.product) {
            throw new Error("EVM withdraw requires --product <vault-id>.");
          }
          result = await withdrawEvm({
            descriptor,
            network,
            productId: flags.product,
            amount: flags.amount,
            dryRun,
            wallet,
            out,
            device,
          });
          break;
        }
        case "solana": {
          if (!flags["stake-account"]) {
            throw new Error("Solana withdraw requires --stake-account <address>.");
          }
          result = await withdrawSolana({
            descriptor,
            network,
            stakeAccount: flags["stake-account"],
            amount: flags.amount,
            finalize: flags.finalize,
            dryRun,
            wallet,
            out,
            device,
          });
          break;
        }
        default:
          throw new Error(
            `Unsupported family for earn withdraw: ${family}. Supported: evm, solana.`,
          );
      }

      out.earnWithdrawResult(result);
    });
  },
});
