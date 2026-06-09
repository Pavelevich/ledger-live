import { Account, TokenAccount } from "./enum/Account";
import { Currency } from "./enum/Currency";

/**
 * Bump whenever the shape of the generated fixtures (AccountRaw serialization,
 * cryptoAssets persistence, address map, or manifest) changes in a way that
 * makes previously generated bundles unsafe to consume. Mirrors the spirit of
 * CAL's `PERSISTENCE_VERSION` guard: a mismatch makes the runtime resolver
 * ignore the fixture and fall back to live generation.
 */
export const E2E_USERDATA_SCHEMA_VERSION = 1;

/** Field separator for fixture map keys. Keys are only ever compared by exact
 * string equality (built identically by generator and consumer), never parsed,
 * so the separator just needs to be stable. */
const SEP = "|";

/**
 * Key under which a scanned account bundle is stored / looked up.
 *
 * Built from the *source* test account (not the scanned `AccountRaw`) so we
 * never depend on how the CLI resolves `--currency <speculosApp>` into a
 * crypto-currency id (e.g. Polkadot's e2e id is `assethub_polkadot`). The
 * `scheme` mirrors what {@link liveDataCommand} actually passes to the CLI:
 * empty unless `useScheme` is set and the account has a derivation mode.
 */
export function accountFixtureKey(currencyId: string, index: number, scheme: string): string {
  return [currencyId, index, scheme].join(SEP);
}

/**
 * Effective `--scheme` value for an account, matching `liveDataCommand`'s
 * `options?.useScheme && account.derivationMode ? account.derivationMode : ""`.
 */
export function effectiveScheme(account: Account, useScheme?: boolean): string {
  return useScheme && account.derivationMode ? account.derivationMode : "";
}

/** Key under which a derived receive address is stored / looked up. Mirrors the
 * `runCliGetAddress` args used by `getAccountAddress`. */
export function addressFixtureKey(speculosApp: string, path: string, derivationMode: string): string {
  return [speculosApp, path, derivationMode].join(SEP);
}

/** A single network scan to run at generation time, plus every fixture key the
 * resulting account bundle must be stored under. */
export type ScanTarget = {
  /** `--currency` value (== `account.currency.speculosApp.name`) and the
   * Speculos app to launch. */
  readonly speculosApp: string;
  readonly index: number;
  /** `--scheme` value; empty string means the flag is omitted. */
  readonly scheme: string;
  readonly accountKeys: string[];
};

/** A single `getAddress` to run at generation time. */
export type AddressTarget = {
  readonly speculosApp: string;
  readonly path: string;
  readonly derivationMode: string;
  readonly addressKey: string;
};

function allTestAccounts(): Array<Account | TokenAccount> {
  const collect = (cls: object): Array<Account | TokenAccount> =>
    Object.values(cls as Record<string, unknown>).filter(
      (value): value is Account | TokenAccount => value instanceof Account,
    );
  return [...collect(Account), ...collect(TokenAccount)];
}

/** Accounts whose receive address is NOT derived through a generic
 * `runCliGetAddress` (so there is nothing deterministic to pre-cache). */
function hasDerivableAddress(account: Account): boolean {
  if (!account.accountPath) return false; // EMPTY / SANCTIONED_ETH
  if (account.currency.id === Currency.HBAR.id) return false; // pre-set address
  if (account.currency.id === Currency.CCD_TESTNET.id) return false; // special derivation
  return true;
}

/**
 * Derive the de-duplicated set of network scans and address derivations to
 * pre-generate, straight from the `Account` / `TokenAccount` enums (the single
 * source of truth used by every e2e spec).
 *
 * For each account we register:
 *  - the default (no `--scheme`) scan, and
 *  - a `--scheme <derivationMode>` scan when the account declares one,
 * so both `liveDataCommand(acc)` and `liveDataCommand(acc, { useScheme: true })`
 * resolve from the cache.
 */
export function getUserdataFixtureManifest(): {
  scanTargets: ScanTarget[];
  addressTargets: AddressTarget[];
} {
  const scanBySig = new Map<string, ScanTarget>();
  const addressBySig = new Map<string, AddressTarget>();

  const registerScan = (speculosApp: string, index: number, scheme: string, accountKey: string) => {
    const sig = [speculosApp, index, scheme].join(SEP);
    const existing = scanBySig.get(sig);
    if (existing) {
      if (!existing.accountKeys.includes(accountKey)) existing.accountKeys.push(accountKey);
    } else {
      scanBySig.set(sig, { speculosApp, index, scheme, accountKeys: [accountKey] });
    }
  };

  for (const account of allTestAccounts()) {
    const speculosApp = account.currency.speculosApp.name;
    const currencyId = account.currency.id;

    // Default scan (no --scheme): liveDataCommand(account)
    registerScan(speculosApp, account.index, "", accountFixtureKey(currencyId, account.index, ""));

    // Scheme-specific scan: liveDataCommand(account, { useScheme: true })
    if (account.derivationMode) {
      registerScan(
        speculosApp,
        account.index,
        account.derivationMode,
        accountFixtureKey(currencyId, account.index, account.derivationMode),
      );
    }

    if (hasDerivableAddress(account)) {
      const derivationMode = account.derivationMode ?? "";
      const sig = [speculosApp, account.accountPath, derivationMode].join(SEP);
      if (!addressBySig.has(sig)) {
        addressBySig.set(sig, {
          speculosApp,
          path: account.accountPath,
          derivationMode,
          addressKey: addressFixtureKey(speculosApp, account.accountPath, derivationMode),
        });
      }
    }
  }

  return {
    scanTargets: [...scanBySig.values()],
    addressTargets: [...addressBySig.values()],
  };
}
