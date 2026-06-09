import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { Account } from "./enum/Account";
import {
  E2E_USERDATA_SCHEMA_VERSION,
  accountFixtureKey,
  addressFixtureKey,
} from "./userdataFixtureManifest";
import {
  __resetFixtureCacheForTests,
  isFixtureCacheUsable,
  setForceLiveFixtures,
  tryGetCachedAddress,
  tryMergeAccountsFromFixture,
} from "./fixtureCache";

const ENV_KEYS = [
  "E2E_USERDATA_ACCOUNTS",
  "E2E_USERDATA_ADDRESSES",
  "E2E_USERDATA_MANIFEST",
  "E2E_FORCE_LIVE_FIXTURES",
  "E2E_USERDATA_SKIP_VALIDATION",
  "E2E_USERDATA_MAX_AGE_HOURS",
  "E2E_USERDATA_EXPECTED_SEED_FP",
] as const;

const account = Account.ATOM_1; // no derivationMode -> default scheme ""
const SCHEME = "";
const ACCOUNT_ID = "js:2:cosmos:fixturexpub:";
const CACHED_ADDRESS = "cosmos1fixtureaddress";

function sha256OfFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

describe("e2e fixtureCache (QAA-1285 consume/fallback)", () => {
  let dir: string;
  let accountsPath: string;
  let addressesPath: string;
  let manifestPath: string;
  let userdataPath: string;

  function buildBundle(opts?: { generatedAt?: string; tamperAccountsHash?: boolean }): void {
    const accountsFile = {
      schemaVersion: E2E_USERDATA_SCHEMA_VERSION,
      accountsByKey: {
        [accountFixtureKey(account.currency.id, account.index, SCHEME)]: [
          { data: { id: ACCOUNT_ID, balance: "42" }, version: 1 },
        ],
      },
      cryptoAssets: { version: 7, tokens: [] },
    };
    const addressesFile = {
      schemaVersion: E2E_USERDATA_SCHEMA_VERSION,
      byKey: {
        [addressFixtureKey(
          account.currency.speculosApp.name,
          account.accountPath,
          account.derivationMode ?? "",
        )]: { address: CACHED_ADDRESS },
      },
    };

    fs.writeFileSync(accountsPath, JSON.stringify(accountsFile));
    fs.writeFileSync(addressesPath, JSON.stringify(addressesFile));

    const manifest = {
      schemaVersion: E2E_USERDATA_SCHEMA_VERSION,
      generatedAt: opts?.generatedAt ?? new Date().toISOString(),
      files: {
        "userdata-accounts.json": opts?.tamperAccountsHash
          ? "deadbeef"
          : sha256OfFile(accountsPath),
        "addresses.json": sha256OfFile(addressesPath),
      },
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  }

  function writeEmptyUserdata(): void {
    fs.writeFileSync(userdataPath, JSON.stringify({ data: { accounts: [] } }));
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-userdata-"));
    accountsPath = path.join(dir, "userdata-accounts.json");
    addressesPath = path.join(dir, "addresses.json");
    manifestPath = path.join(dir, "manifest.json");
    userdataPath = path.join(dir, "app.json");

    for (const key of ENV_KEYS) delete process.env[key];
    process.env.E2E_USERDATA_ACCOUNTS = accountsPath;
    process.env.E2E_USERDATA_ADDRESSES = addressesPath;

    setForceLiveFixtures(false);
    __resetFixtureCacheForTests();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const key of ENV_KEYS) delete process.env[key];
    setForceLiveFixtures(false);
    __resetFixtureCacheForTests();
  });

  it("should merge the cached account bundle without a scan when the bundle is valid", () => {
    buildBundle();
    writeEmptyUserdata();

    expect(isFixtureCacheUsable()).toBe(true);
    expect(tryMergeAccountsFromFixture(userdataPath, account, SCHEME)).toBe(true);

    const written = JSON.parse(fs.readFileSync(userdataPath, "utf-8"));
    expect(written.data.accounts).toHaveLength(1);
    expect(written.data.accounts[0].data.id).toBe(ACCOUNT_ID);
    expect(written.data.cryptoAssets).toEqual({ version: 7, tokens: [] });
  });

  it("should not duplicate an account already present in the userdata (skip-by-id)", () => {
    buildBundle();
    fs.writeFileSync(
      userdataPath,
      JSON.stringify({ data: { accounts: [{ data: { id: ACCOUNT_ID }, version: 1 }] } }),
    );

    expect(tryMergeAccountsFromFixture(userdataPath, account, SCHEME)).toBe(true);
    const written = JSON.parse(fs.readFileSync(userdataPath, "utf-8"));
    expect(written.data.accounts).toHaveLength(1);
  });

  it("should return the pre-derived address", () => {
    buildBundle();
    expect(tryGetCachedAddress(account)).toBe(CACHED_ADDRESS);
  });

  it("should fall back to live generation when the integrity check fails", () => {
    buildBundle({ tamperAccountsHash: true });
    writeEmptyUserdata();

    expect(isFixtureCacheUsable()).toBe(false);
    expect(tryMergeAccountsFromFixture(userdataPath, account, SCHEME)).toBe(false);
    expect(tryGetCachedAddress(account)).toBeUndefined();
  });

  it("should fall back when the bundle is older than the freshness window", () => {
    buildBundle({ generatedAt: new Date(Date.now() - 100 * 3_600_000).toISOString() }); // 100h > 36h default
    expect(isFixtureCacheUsable()).toBe(false);
  });

  it("should honor E2E_USERDATA_MAX_AGE_HOURS to accept an older bundle", () => {
    buildBundle({ generatedAt: new Date(Date.now() - 100 * 3_600_000).toISOString() });
    process.env.E2E_USERDATA_MAX_AGE_HOURS = "200";
    __resetFixtureCacheForTests();
    expect(isFixtureCacheUsable()).toBe(true);
  });

  it("should force live generation when the freshFixtures opt-out is active", () => {
    buildBundle();
    writeEmptyUserdata();
    setForceLiveFixtures(true);

    expect(isFixtureCacheUsable()).toBe(false);
    expect(tryMergeAccountsFromFixture(userdataPath, account, SCHEME)).toBe(false);
    expect(tryGetCachedAddress(account)).toBeUndefined();
  });

  it("should be a no-op (today's behavior) when the fixture env vars are unset", () => {
    delete process.env.E2E_USERDATA_ACCOUNTS;
    delete process.env.E2E_USERDATA_ADDRESSES;
    __resetFixtureCacheForTests();
    writeEmptyUserdata();

    expect(isFixtureCacheUsable()).toBe(false);
    expect(tryMergeAccountsFromFixture(userdataPath, account, SCHEME)).toBe(false);
    expect(tryGetCachedAddress(account)).toBeUndefined();
  });
});
