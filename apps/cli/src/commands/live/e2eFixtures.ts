import { generateUserdataFixtures } from "@ledgerhq/live-common/e2e/generateUserdataFixtures";

type E2eFixturesJobOpts = Partial<{
  out: string;
  only: string[];
}>;

export default {
  description:
    "Pre-generate e2e userdata fixtures (accounts + addresses) once via Speculos, for reuse by the day's e2e runs (QAA-1285).",
  args: [
    {
      name: "out",
      alias: "o",
      type: String,
      typeDesc: "directory",
      desc: "output directory for userdata-accounts.json, addresses.json and manifest.json",
    },
    {
      name: "only",
      type: String,
      multiple: true,
      desc: "restrict generation to these Speculos app names (debug / partial runs)",
    },
  ],
  job: async (opts: E2eFixturesJobOpts): Promise<string> => {
    // Point the child CLI processes spawned by the generator (runCli) at the
    // exact bin we're running, regardless of how live-common was bundled.
    if (!process.env.LEDGER_LIVE_CLI_BIN && process.argv[1]) {
      process.env.LEDGER_LIVE_CLI_BIN = process.argv[1];
    }

    const outDir = opts.out || "e2e/_fixtures";
    const result = await generateUserdataFixtures({ outDir, onlyApps: opts.only });

    const lines = [
      `Generated e2e userdata fixtures in ${result.outDir}`,
      `  account bundles : ${result.scannedKeys}`,
      `  addresses       : ${result.derivedAddresses}`,
    ];
    if (result.skippedApps.length) {
      lines.push(`  skipped apps    : ${result.skippedApps.join(", ")}`);
    }
    if (result.failures.length) {
      lines.push(`  non-fatal fails : ${result.failures.length}`);
    }
    return lines.join("\n");
  },
};
