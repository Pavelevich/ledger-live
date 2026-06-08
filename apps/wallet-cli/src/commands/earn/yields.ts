import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { getCurrencyProviders, getGrow } from "../../api/earn-api";
import type { CurrencyProvider, GrowItem } from "../../api/earn-api.types";
import { createCommandOutput } from "../../output";
import { currencyIdFromNetwork, parseNetworkArg } from "../../shared/accountDescriptor";
import type { EarnYieldRow } from "../../wallet/earn/types";
import { outputOption, resolveOutputFormat } from "../inputs";

function growItemToRow(item: GrowItem): EarnYieldRow {
  return {
    network: item.network,
    provider: item.provider,
    depositToken: item.deposit_token,
    interestType: item.interest.type,
    interestValue: item.interest.value,
  };
}

function providerToRow(provider: CurrencyProvider, network: string): EarnYieldRow {
  return {
    network,
    provider: provider.name,
    depositToken: network,
    interestType: "APY",
    interestValue: provider.apy === undefined ? "" : String(provider.apy / 100),
    providerId: provider.id,
    category: provider.category,
    apy: provider.apy,
    min: provider.min,
    liveAppId: provider.liveAppId,
  };
}

export default defineCommand({
  name: "yields",
  description: "List earn yield opportunities (no device required)",
  options: {
    network: option(z.string().min(1).optional(), {
      description:
        'Filter by network and enrich with provider details, e.g. "ethereum", "solana". No env = mainnet.',
      short: "n",
    }),
    output: outputOption,
  },
  handler: async ({ flags }) => {
    const output = resolveOutputFormat(flags.output);
    const networkArg = flags.network;
    const out = createCommandOutput(output, {
      command: "earn yields",
      network: networkArg ?? "",
    });

    await out.run(async () => {
      const grow = await getGrow({ dashboardSupported: true });

      let rows: EarnYieldRow[];
      if (networkArg) {
        const network = parseNetworkArg(networkArg);
        const growRows = grow.filter(item => item.network === network.name).map(growItemToRow);

        // Enrich with provider-level details (APY, category, min) for the requested network.
        const currencyId = currencyIdFromNetwork(network);
        const providers = await getCurrencyProviders(currencyId);
        const providerRows = providers
          .filter(p => p.active)
          .map(p => providerToRow(p, network.name));

        rows = [...growRows, ...providerRows];
      } else {
        rows = grow.map(growItemToRow);
      }

      out.earnYields(rows);
    });
  },
});
