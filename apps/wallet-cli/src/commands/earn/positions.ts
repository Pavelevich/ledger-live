import { defineCommand, option } from "@bunli/core";
import { z } from "zod";
import { getStakes } from "../../api/earn-api";
import { createCommandOutput } from "../../output";
import { serializeNetwork } from "../../shared/accountDescriptor";
import type { EarnPositionRow } from "../../wallet/earn/types";
import {
  accountOption,
  outputOption,
  resolveAccountArg,
  resolveAccountDescriptorV1,
  resolveOutputFormat,
} from "../inputs";

export default defineCommand({
  name: "positions",
  description: "List earn positions for an account (no device required)",
  options: {
    account: accountOption,
    fresh: option(z.boolean().default(false), {
      description: "Request a fresh (uncached) read from the backend",
      argumentKind: "flag",
    }),
    output: outputOption,
  },
  handler: async ({ flags, positional }) => {
    const output = resolveOutputFormat(flags.output);
    const ctx = { command: "earn positions", network: "", account: "" };
    const out = createCommandOutput(output, ctx);

    await out.run(async () => {
      const v1 = await resolveAccountDescriptorV1(resolveAccountArg(flags.account, positional));
      if (v1.type !== "address") {
        throw new Error(
          "Earn positions are only supported for account-based networks (e.g. solana, ethereum).",
        );
      }
      const network = v1.network.name;
      const address = v1.address;
      ctx.network = serializeNetwork(v1.network);
      ctx.account = address;

      const fresh = flags.fresh;
      const views = await getStakes([{ network, address, fresh }]);

      // TODO(sol-agent): optionally enrich Solana positions with on-chain stake-account data
      // (coin-solana getStakeAccounts) so undelegate/withdraw can target a concrete stake account.
      const rows: EarnPositionRow[] = views.map(data => ({
        network,
        address,
        fresh,
        data,
      }));

      out.earnPositions(rows);
    });
  },
});
