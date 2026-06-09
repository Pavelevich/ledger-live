import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Account, TokenAccount } from "./enum/Account";
import {
  E2E_USERDATA_SCHEMA_VERSION,
  accountFixtureKey,
  addressFixtureKey,
} from "./userdataFixtureManifest";

/* -------------------------------------------------------------------------- */
/*                              On-disk fixture format                         */
/* -------------------------------------------------------------------------- */

/** One serialized account, shaped exactly like an entry of `app.json`'s
 * `data.accounts` (so it can be appended verbatim). */
export type AccountEntry = { data: { id?: string } & Record<string, unknown>; version: number };

/** Persisted CAL token cache, shaped like `app.json`'s `data.cryptoAssets`. */
export type CryptoAssets = { version: number; tokens: unknown[] };

/** `userdata-accounts.json` */
export type UserdataAccountsFile = {
  schemaVersion: number;
  /** keyed by {@link accountFixtureKey} */
  accountsByKey: Record<string, AccountEntry[]>;
  cryptoAssets?: CryptoAssets;
};

export type AddressEntry = { address: string; publicKey?: string; path?: string };

/** `addresses.json` */
export type AddressesFile = {
  schemaVersion: number;
  /** keyed by {@link addressFixtureKey} */
  byKey: Record<string, AddressEntry>;
};

/** `manifest.json` */
export type FixtureManifestFile = {
  schemaVersion: number;
  generatedAt: string;
  device?: string;
  coinAppsCommit?: string;
  /** sha256 of a known, non-secret derived address used to detect seed drift. */
  seedFingerprint?: string;
  /** basename -> sha256 of file contents */
  files: Record<string, string>;
};

/* -------------------------------------------------------------------------- */
/*                                  Env knobs                                  */
/* -------------------------------------------------------------------------- */

const ENV = {
  accounts: "E2E_USERDATA_ACCOUNTS",
  addresses: "E2E_USERDATA_ADDRESSES",
  manifest: "E2E_USERDATA_MANIFEST",
  forceLive: "E2E_FORCE_LIVE_FIXTURES",
  skipValidation: "E2E_USERDATA_SKIP_VALIDATION",
  maxAgeHours: "E2E_USERDATA_MAX_AGE_HOURS",
  expectedSeedFp: "E2E_USERDATA_EXPECTED_SEED_FP",
} as const;

const DEFAULT_MAX_AGE_HOURS = 36;

/* -------------------------------------------------------------------------- */
/*                          Per-test / global opt-out                          */
/* -------------------------------------------------------------------------- */

let forceLiveOverride = false;

/**
 * Force live generation (skip every fixture) for the duration of a test. The
 * desktop fixture / mobile init layer toggle this around setup when a spec opts
 * out via `freshFixtures` (e.g. exact balance / operation assertions).
 */
export function setForceLiveFixtures(force: boolean): void {
  forceLiveOverride = force;
}

function isForcedLive(): boolean {
  return forceLiveOverride || process.env[ENV.forceLive] === "1";
}

/* -------------------------------------------------------------------------- */
/*                              Load + validate                                */
/* -------------------------------------------------------------------------- */

type LoadedCache = { accounts: UserdataAccountsFile; addresses: AddressesFile };

// `undefined` = not yet computed, `null` = computed and unusable.
let cached: LoadedCache | null | undefined;

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function readJson<T>(filePath: string): { value: T; raw: Buffer } {
  const raw = fs.readFileSync(filePath);
  return { value: JSON.parse(raw.toString("utf-8")) as T, raw };
}

function warn(message: string): void {
  console.warn(`[e2e-fixtures] ${message} -> falling back to live generation.`);
}

function loadCacheUncached(): LoadedCache | null {
  const accountsPath = process.env[ENV.accounts];
  const addressesPath = process.env[ENV.addresses];
  if (!accountsPath || !addressesPath) return null;

  let accountsFile: UserdataAccountsFile;
  let addressesFile: AddressesFile;
  let accountsRaw: Buffer;
  let addressesRaw: Buffer;
  try {
    ({ value: accountsFile, raw: accountsRaw } = readJson<UserdataAccountsFile>(accountsPath));
    ({ value: addressesFile, raw: addressesRaw } = readJson<AddressesFile>(addressesPath));
  } catch (error) {
    warn(`could not read fixture files (${String(error)})`);
    return null;
  }

  if (
    accountsFile?.schemaVersion !== E2E_USERDATA_SCHEMA_VERSION ||
    addressesFile?.schemaVersion !== E2E_USERDATA_SCHEMA_VERSION
  ) {
    warn(
      `schema mismatch (expected ${E2E_USERDATA_SCHEMA_VERSION}, got accounts=${accountsFile?.schemaVersion} addresses=${addressesFile?.schemaVersion})`,
    );
    return null;
  }
  if (!accountsFile.accountsByKey || !addressesFile.byKey) {
    warn("fixture files are missing expected sections");
    return null;
  }

  if (process.env[ENV.skipValidation] === "1") {
    return { accounts: accountsFile, addresses: addressesFile };
  }

  const manifestPath =
    process.env[ENV.manifest] || path.join(path.dirname(accountsPath), "manifest.json");
  let manifest: FixtureManifestFile;
  try {
    ({ value: manifest } = readJson<FixtureManifestFile>(manifestPath));
  } catch (error) {
    warn(`could not read manifest at ${manifestPath} (${String(error)})`);
    return null;
  }

  if (manifest?.schemaVersion !== E2E_USERDATA_SCHEMA_VERSION) {
    warn(`manifest schema mismatch (got ${manifest?.schemaVersion})`);
    return null;
  }

  const files = manifest.files ?? {};
  const accountsHash = sha256(accountsRaw);
  const addressesHash = sha256(addressesRaw);
  if (
    files[path.basename(accountsPath)] !== accountsHash ||
    files[path.basename(addressesPath)] !== addressesHash
  ) {
    warn("integrity check failed (sha256 mismatch with manifest)");
    return null;
  }

  const maxAgeHours = Number(process.env[ENV.maxAgeHours]) || DEFAULT_MAX_AGE_HOURS;
  const generatedAt = Date.parse(manifest.generatedAt);
  if (Number.isNaN(generatedAt)) {
    warn("manifest has an invalid generatedAt");
    return null;
  }
  const ageHours = (Date.now() - generatedAt) / 3_600_000;
  if (ageHours > maxAgeHours) {
    warn(`fixtures are stale (${ageHours.toFixed(1)}h old > ${maxAgeHours}h)`);
    return null;
  }

  const expectedSeedFp = process.env[ENV.expectedSeedFp];
  if (expectedSeedFp && manifest.seedFingerprint && expectedSeedFp !== manifest.seedFingerprint) {
    warn("seed fingerprint mismatch (fixtures generated with a different seed/coin-apps)");
    return null;
  }

  return { accounts: accountsFile, addresses: addressesFile };
}

function loadCache(): LoadedCache | null {
  if (cached === undefined) cached = loadCacheUncached();
  return cached;
}

/** Test-only: drop the memoized cache (used by unit tests that mutate env). */
export function __resetFixtureCacheForTests(): void {
  cached = undefined;
  forceLiveOverride = false;
}

/** Whether a valid, fresh fixture bundle is available right now. */
export function isFixtureCacheUsable(): boolean {
  if (isForcedLive()) return false;
  return loadCache() !== null;
}

/* -------------------------------------------------------------------------- */
/*                              Consumption helpers                            */
/* -------------------------------------------------------------------------- */

/**
 * Merge the pre-scanned account bundle for `(account, scheme)` into the test's
 * `app.json` at `userdataPath`, mimicking the CLI `liveData --add` write
 * (skip-by-id de-dup + cryptoAssets). Returns `true` when the bundle was found
 * and merged (no network scan needed); `false` (the safe default) when the
 * caller should fall back to live generation.
 */
export function tryMergeAccountsFromFixture(
  userdataPath: string | undefined,
  account: Account | TokenAccount,
  scheme: string,
): boolean {
  if (isForcedLive() || !userdataPath) return false;
  const cache = loadCache();
  if (!cache) return false;

  const key = accountFixtureKey(account.currency.id, account.index, scheme);
  const entries = cache.accounts.accountsByKey[key];
  if (!entries || entries.length === 0) return false;

  try {
    const raw = JSON.parse(fs.readFileSync(userdataPath, "utf-8"));
    raw.data = raw.data ?? {};
    if (typeof raw.data.accounts === "string") return false; // encrypted: let live handle it
    raw.data.accounts = raw.data.accounts ?? [];

    const existingIds = new Set<string>(
      raw.data.accounts.map((entry: { data?: { id?: string } }) => entry?.data?.id),
    );
    for (const entry of entries) {
      const id = entry?.data?.id;
      if (id && !existingIds.has(id)) {
        raw.data.accounts.push(entry);
        existingIds.add(id);
      }
    }

    if (cache.accounts.cryptoAssets && !raw.data.cryptoAssets) {
      raw.data.cryptoAssets = cache.accounts.cryptoAssets;
    }

    fs.writeFileSync(userdataPath, JSON.stringify(raw), "utf-8");
    return true;
  } catch (error) {
    warn(`failed merging cached accounts for "${key}" (${String(error)})`);
    return false;
  }
}

/** Pre-derived receive address for an account, or `undefined` to derive live. */
export function tryGetCachedAddress(account: Account | TokenAccount): string | undefined {
  if (isForcedLive()) return undefined;
  const cache = loadCache();
  if (!cache) return undefined;

  const key = addressFixtureKey(
    account.currency.speculosApp.name,
    account.accountPath,
    account.derivationMode ?? "",
  );
  return cache.addresses.byKey[key]?.address;
}
