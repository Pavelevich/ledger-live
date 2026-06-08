import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { getCryptoCurrencyById } from "@ledgerhq/live-common/currencies/index";
import { WALLET_CLI_DMK_DEVICE_ID } from "../../device/register-dmk-transport";
import { getManagerAppNameForCurrencyId } from "../../session/bridge-device-session";
import { networkStringFromCurrencyId } from "../../shared/accountDescriptor";
import { createCommandOutput } from "../../output";
import { WalletAdapter } from "../../wallet";
import { depositEvm } from "../../wallet/earn/eth-vault-pipeline";
import { depositSolana } from "../../wallet/earn/sol-stake";
import type { EarnDepositResult } from "../../wallet/earn/types";
import {
  accountOption,
  deviceTimeoutOption,
  outputOption,
  resolveAccountArg,
  resolveAccountDescriptor,
  resolveOutputFormat,
} from "../inputs";

export default defineCommand({
  name: "deposit",
  description: "Deposit funds into an earn product (ETH vault) or stake (Solana)",
  options: {
    account: accountOption,
    product: option(z.string().min(1, "Product is required (--product <vault-id|validator>)"), {
      description: "ETH: vault id from `earn yields`. Solana: validator vote account address.",
      short: "p",
    }),
    amount: option(z.string().min(1, "Amount is required (--amount <value>)"), {
      description: "Amount to deposit, e.g. '100 USDC' (ETH) or '1.5 SOL' (Solana)",
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
    const ctx = { command: "earn deposit", network: "", account: "" };
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

      let result: EarnDepositResult;
      switch (family) {
        case "evm":
          result = await depositEvm({
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
        case "solana":
          result = await depositSolana({
            descriptor,
            network,
            validator: flags.product,
            amount: flags.amount,
            dryRun,
            wallet,
            out,
            device,
          });
          break;
        default:
          throw new Error(
            `Unsupported family for earn deposit: ${family}. Supported: evm, solana.`,
          );
      }

      out.earnDepositResult(result);
    });
  },
});
