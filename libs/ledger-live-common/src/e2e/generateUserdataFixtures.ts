import fs from "fs";
import path from "path";
import crypto, { randomUUID } from "crypto";
import { setEnv } from "@ledgerhq/live-env";
import { startSpeculos, stopSpeculos, specs } from "./speculos";
import { runCliLiveData, runCliGetAddress } from "./runCli";
import { getSpeculosModel } from "./speculosAppVersion";
import { sanitizeError } from "./index";
import {
  E2E_USERDATA_SCHEMA_VERSION,
  addressFixtureKey,
  getUserdataFixtureManifest,
  type ScanTarget,
} from "./userdataFixtureManifest";
import type {
  AccountEntry,
  AddressEntry,
  AddressesFile,
  CryptoAssets,
  FixtureManifestFile,
  UserdataAccountsFile,
} from "./fixtureCache";

export const ACCOUNTS_FILENAME = "userdata-accounts.json";
export const ADDRESSES_FILENAME = "addresses.json";
export const MANIFEST_FILENAME = "manifest.json";

export type GenerateOptions = {
  /** Output directory for the three fixture files. */
  outDir: string;
  /** Restrict generation to these Speculos app names (debug / partial runs). */
  onlyApps?: string[];
};

export type GenerateResult = {
  outDir: string;
  scannedKeys: number;
  derivedAddresses: number;
  skippedApps: string[];
  failures: string[];
};

function specForApp(appName: string) {
  return specs[appName.replace(/ /g, "_")];
}

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function groupByApp<T extends { speculosApp: string }>(targets: T[]): Map<string, T[]> {
  const byApp = new Map<string, T[]>();
  for (const target of targets) {
    const list = byApp.get(target.speculosApp) ?? [];
    list.push(target);
    byApp.set(target.speculosApp, list);
  }
  return byApp;
}

/**
 * Pre-generate the e2e userdata fixtures by replaying, once, the exact CLI path
 * the per-test setup uses (`liveData` scan + `getAddress`) against a local
 * Speculos for every account in the manifest. The heavy network scan therefore
 * happens O(1) per night instead of O(runs x scenarios).
 *
 * Each `liveData` / `getAddress` is spawned as a fresh CLI child (same as
 * tests), so the produced `AccountRaw` / address bytes are identical to what a
 * live run would write.
 */
export async function generateUserdataFixtures(options: GenerateOptions): Promise<GenerateResult> {
  const { outDir, onlyApps } = options;
  fs.mkdirSync(outDir, { recursive: true });

  // Speculos needs a writable nano-app catalog path; create one next to the
  // output if the env isn't already pointing somewhere.
  if (!process.env.E2E_NANO_APP_VERSION_PATH) {
    setEnv("E2E_NANO_APP_VERSION_PATH", path.join(outDir, "nano-app-catalog.json"));
  }

  const { scanTargets, addressTargets } = getUserdataFixtureManifest();
  const scansByApp = groupByApp(scanTargets);
  const addressesByApp = groupByApp(addressTargets);
  const appNames = [...new Set([...scansByApp.keys(), ...addressesByApp.keys()])].sort();

  const accountsByKey: Record<string, AccountEntry[]> = {};
  const addressByKey: Record<string, AddressEntry> = {};
  const tokensByHash = new Map<string, unknown>();
  let cryptoAssetsVersion = 0;
  const skippedApps: string[] = [];
  const failures: string[] = [];

  const mergeCryptoAssets = (cryptoAssets: CryptoAssets | undefined) => {
    if (!cryptoAssets) return;
    cryptoAssetsVersion = Math.max(cryptoAssetsVersion, cryptoAssets.version ?? 0);
    for (const token of cryptoAssets.tokens ?? []) {
      tokensByHash.set(sha256(Buffer.from(JSON.stringify(token))), token);
    }
  };

  for (const appName of appNames) {
    if (onlyApps && !onlyApps.includes(appName)) continue;

    const spec = specForApp(appName);
    if (!spec) {
      console.warn(`[gen] no Speculos spec for app "${appName}", skipping its accounts`);
      skippedApps.push(appName);
      continue;
    }

    console.warn(`[gen] launching Speculos for ${appName}…`);
    let device: Awaited<ReturnType<typeof startSpeculos>>;
    try {
      device = await startSpeculos("e2e-userdata-gen", spec);
    } catch (error) {
      const message = `[gen] failed to launch Speculos for ${appName}: ${sanitizeError(error)}`;
      console.error(message);
      failures.push(message);
      continue;
    }
    if (!device) {
      const message = `[gen] Speculos not started for ${appName}`;
      console.error(message);
      failures.push(message);
      continue;
    }

    setEnv("SPECULOS_API_PORT", device.port);
    process.env.SPECULOS_API_PORT = String(device.port);

    try {
      for (const target of scansByApp.get(appName) ?? []) {
        try {
          const entries = await scanTarget(outDir, target);
          mergeCryptoAssets(entries.cryptoAssets);
          for (const key of target.accountKeys) {
            accountsByKey[key] = entries.accounts;
          }
          console.warn(
            `[gen]   scanned ${appName} index=${target.index} scheme="${target.scheme}" -> ${entries.accounts.length} account(s)`,
          );
        } catch (error) {
          const message = `[gen] scan failed for ${appName} index=${target.index} scheme="${target.scheme}": ${sanitizeError(error)}`;
          console.error(message);
          failures.push(message);
        }
      }

      for (const target of addressesByApp.get(appName) ?? []) {
        try {
          const result = await runCliGetAddress({
            currency: target.speculosApp,
            path: target.path,
            derivationMode: target.derivationMode || undefined,
          });
          addressByKey[target.addressKey] = {
            address: result.address,
            publicKey: result.publicKey,
            path: result.path,
          };
        } catch (error) {
          const message = `[gen] getAddress failed for ${appName} path=${target.path}: ${sanitizeError(error)}`;
          console.error(message);
          failures.push(message);
        }
      }
    } finally {
      await stopSpeculos(device.id);
      process.env.SPECULOS_API_PORT = undefined;
      delete process.env.SPECULOS_API_PORT;
    }
  }

  const scannedKeys = Object.keys(accountsByKey).length;
  const derivedAddresses = Object.keys(addressByKey).length;
  if (scannedKeys === 0) {
    throw new Error(`[gen] produced no account bundles (failures: ${failures.length}); aborting`);
  }

  writeFixtures(outDir, {
    accountsByKey,
    cryptoAssets: { version: cryptoAssetsVersion, tokens: [...tokensByHash.values()] },
    addressByKey,
  });

  return { outDir, scannedKeys, derivedAddresses, skippedApps, failures };
}

async function scanTarget(
  outDir: string,
  target: ScanTarget,
): Promise<{ accounts: AccountEntry[]; cryptoAssets: CryptoAssets | undefined }> {
  const tmp = path.join(outDir, `.scan-${randomUUID()}.json`);
  fs.writeFileSync(tmp, JSON.stringify({ data: { accounts: [] } }), "utf-8");
  try {
    await runCliLiveData({
      currency: target.speculosApp,
      index: target.index,
      ...(target.scheme ? { scheme: target.scheme } : {}),
      add: true,
      appjson: tmp,
    });
    const parsed = JSON.parse(fs.readFileSync(tmp, "utf-8"));
    const accounts: AccountEntry[] = parsed?.data?.accounts ?? [];
    const cryptoAssets: CryptoAssets | undefined = parsed?.data?.cryptoAssets;
    return { accounts, cryptoAssets };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // best-effort cleanup
    }
  }
}

function writeFixtures(
  outDir: string,
  data: {
    accountsByKey: Record<string, AccountEntry[]>;
    cryptoAssets: CryptoAssets;
    addressByKey: Record<string, AddressEntry>;
  },
): void {
  const accountsFile: UserdataAccountsFile = {
    schemaVersion: E2E_USERDATA_SCHEMA_VERSION,
    accountsByKey: data.accountsByKey,
    cryptoAssets: data.cryptoAssets,
  };
  const addressesFile: AddressesFile = {
    schemaVersion: E2E_USERDATA_SCHEMA_VERSION,
    byKey: data.addressByKey,
  };

  const accountsBuf = Buffer.from(JSON.stringify(accountsFile));
  const addressesBuf = Buffer.from(JSON.stringify(addressesFile));

  // Non-secret seed fingerprint: sha256 of a deterministic public address.
  const canonicalAddress =
    data.addressByKey[addressFixtureKey("Ethereum", "44'/60'/0'/0/0", "")]?.address ??
    Object.values(data.addressByKey)[0]?.address;
  const seedFingerprint = canonicalAddress ? sha256(Buffer.from(canonicalAddress)) : undefined;

  const manifestFile: FixtureManifestFile = {
    schemaVersion: E2E_USERDATA_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    device: process.env.SPECULOS_DEVICE || getSpeculosModel(),
    coinAppsCommit: process.env.COIN_APPS_COMMIT || process.env.COINAPPS_COMMIT,
    seedFingerprint,
    files: {
      [ACCOUNTS_FILENAME]: sha256(accountsBuf),
      [ADDRESSES_FILENAME]: sha256(addressesBuf),
    },
  };

  fs.writeFileSync(path.join(outDir, ACCOUNTS_FILENAME), accountsBuf);
  fs.writeFileSync(path.join(outDir, ADDRESSES_FILENAME), addressesBuf);
  fs.writeFileSync(
    path.join(outDir, MANIFEST_FILENAME),
    Buffer.from(JSON.stringify(manifestFile, null, 2)),
  );
}
