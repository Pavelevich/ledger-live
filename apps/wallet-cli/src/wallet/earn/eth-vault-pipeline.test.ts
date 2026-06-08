import { describe, expect, it } from "bun:test";
import type { DefiProduct, DefiTransactionData } from "../../api/earn-api.types";
import {
  assertTransactionTarget,
  parseAmountToBaseUnits,
  resolveDefiProduct,
} from "./eth-vault-pipeline";

const PRODUCT: DefiProduct = {
  id: "usdc-vault",
  chain: "eth",
  chain_id: 1,
  address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  vault_id: "kiln-usdc",
  vault: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  asset: "0xcccccccccccccccccccccccccccccccccccccccc",
  asset_symbol: "USDC",
  currency: "ethereum/erc20/usd__coin",
  asset_decimals: 6,
};

const TRANSACTION: DefiTransactionData = {
  wallet: "0x1111111111111111111111111111111111111111",
  to: PRODUCT.vault ?? "",
  data: "0xabcdef",
  value: "0",
  nonce: 1,
  gas_limit: 50_000,
  chain_id: 1,
};

describe("resolveDefiProduct", () => {
  it("matches id, vault_id, address, and vault case-insensitively", () => {
    expect(resolveDefiProduct([PRODUCT], "USDC-VAULT")).toBe(PRODUCT);
    expect(resolveDefiProduct([PRODUCT], "KILN-USDC")).toBe(PRODUCT);
    expect(resolveDefiProduct([PRODUCT], "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(
      PRODUCT,
    );
    expect(resolveDefiProduct([PRODUCT], "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB")).toBe(
      PRODUCT,
    );
  });

  it("throws for products outside the allowlist", () => {
    expect(() => resolveDefiProduct([PRODUCT], "unknown")).toThrow(/Unknown EVM earn product/);
  });
});

describe("parseAmountToBaseUnits", () => {
  it("converts human decimals to integer base units", () => {
    expect(parseAmountToBaseUnits("1", 6)).toBe("1000000");
    expect(parseAmountToBaseUnits("1.23 USDC", 6)).toBe("1230000");
    expect(parseAmountToBaseUnits("USDC 0.000001", 6)).toBe("1");
    expect(parseAmountToBaseUnits("0.0", 18)).toBe("0");
  });

  it("rejects over-precise and malformed amounts", () => {
    expect(() => parseAmountToBaseUnits("0.0000001", 6)).toThrow(/too many decimal places/);
    expect(() => parseAmountToBaseUnits("-1", 6)).toThrow(/Invalid amount/);
    expect(() => parseAmountToBaseUnits("1e3", 6)).toThrow(/Invalid amount/);
  });
});

describe("assertTransactionTarget", () => {
  it("accepts matching targets case-insensitively", () => {
    expect(() =>
      assertTransactionTarget(TRANSACTION, "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", "deposit"),
    ).not.toThrow();
  });

  it("rejects backend transactions targeting a non-allowlisted contract", () => {
    expect(() =>
      assertTransactionTarget(
        { ...TRANSACTION, to: "0xdddddddddddddddddddddddddddddddddddddddd" },
        PRODUCT.vault ?? "",
        "deposit",
      ),
    ).toThrow(/Refusing to sign deposit/);
  });
});
