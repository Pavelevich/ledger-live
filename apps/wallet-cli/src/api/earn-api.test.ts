import { afterEach, describe, expect, it } from "bun:test";
import {
  getCurrencyProviders,
  getEarnApiBaseUrl,
  getGrow,
  getStakes,
  getStakesV3,
  postDefiApprove,
} from "./earn-api";

const realFetch = globalThis.fetch;

type Captured = { url: string; init?: RequestInit };

function mockFetch(payload: unknown, status = 200): Captured {
  const captured: Captured = { url: "" };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.url = String(input);
    captured.init = init;
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return captured;
}

function mockEmptyFetch(status: number): Captured {
  const captured: Captured = { url: "" };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.url = String(input);
    captured.init = init;
    return new Response(null, { status });
  }) as typeof fetch;
  return captured;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.EARN_API_BASE_URL;
});

describe("earn-api base URL", () => {
  it("defaults to the production earn API", () => {
    expect(getEarnApiBaseUrl()).toBe("https://earn.api.live.ledger.com");
  });

  it("can be overridden via EARN_API_BASE_URL (trailing slash stripped)", () => {
    process.env.EARN_API_BASE_URL = "https://earn.example.test/";
    expect(getEarnApiBaseUrl()).toBe("https://earn.example.test");
  });
});

describe("getGrow", () => {
  it("parses a grow response and sets the dashboard_supported query", async () => {
    const captured = mockFetch([
      {
        provider: "Kiln",
        network: "solana",
        deposit_token: "solana",
        interest: { type: "APY", value: "0.056", currency: "solana" },
        dashboard_enabled: true,
        providers: [
          {
            id: "kiln_solana",
            currency: "solana",
            provider: "Kiln",
            receipt_currency: "solana",
            last_update: "2026-06-05T14:34:45Z",
          },
        ],
        type: "Supported",
      },
    ]);

    const result = await getGrow();
    expect(captured.url).toContain("/v0/grow?dashboard_supported=true");
    expect(result).toHaveLength(1);
    expect(result[0].provider).toBe("Kiln");
    expect(result[0].interest.value).toBe("0.056");
  });
});

describe("getCurrencyProviders", () => {
  it("parses providers and keeps unknown categories as strings", async () => {
    mockFetch([
      {
        id: "lido",
        name: "Lido",
        apy: 2.47,
        category: "liquid",
        icon: "Lido:provider",
        liveAppId: "lido",
        active: true,
        rewardsCurrency: "stETH",
      },
      {
        id: "future",
        name: "Future",
        category: "brand-new-category",
        icon: "x",
        liveAppId: "y",
        active: false,
      },
    ]);

    const result = await getCurrencyProviders("ethereum");
    expect(result).toHaveLength(2);
    expect(result[0].apy).toBe(2.47);
    expect(result[1].category).toBe("brand-new-category");
  });
});

describe("getStakes", () => {
  it("POSTs the batch and parses the bare array (v1)", async () => {
    const captured = mockFetch([{ network: "solana", state: "active" }]);
    const result = await getStakes([{ network: "solana", address: "abc", fresh: true }]);

    expect(captured.init?.method).toBe("POST");
    expect(JSON.parse(String(captured.init?.body))).toEqual([
      { network: "solana", address: "abc", fresh: true },
    ]);
    expect(result).toHaveLength(1);
  });

  it("parses the v3 wrapper with meta.is_stale", async () => {
    mockFetch({ data: [], meta: { is_stale: true, stale_at: "2026-06-05T14:39:06Z" } });
    const result = await getStakesV3([{ network: "solana", address: "abc" }]);
    expect(result.data).toEqual([]);
    expect(result.meta?.is_stale).toBe(true);
  });
});

describe("postDefiApprove", () => {
  const request = {
    wallet: "0x1111111111111111111111111111111111111111",
    asset: "0x2222222222222222222222222222222222222222",
    chain_id: 1,
    vault: "0x3333333333333333333333333333333333333333",
    amount: "1000000",
    ignore_checks: true,
  };

  it("returns a no-action result for 204", async () => {
    const captured = mockEmptyFetch(204);
    const result = await postDefiApprove(request);

    expect(captured.init?.method).toBe("POST");
    expect(result).toEqual({ status: 204, kind: "no-action" });
  });

  it("parses a 200 approve transaction", async () => {
    mockFetch({
      data: {
        wallet: request.wallet,
        to: request.asset,
        data: "0x095ea7b3",
        value: "0",
        nonce: 1,
        gas_limit: 50000,
        chain_id: 1,
      },
    });

    const result = await postDefiApprove(request);

    expect(result.kind).toBe("transaction");
    if (result.kind === "transaction") {
      expect(result.data.to).toBe(request.asset);
      expect(result.data.data).toBe("0x095ea7b3");
    }
  });
});

describe("error handling", () => {
  it("throws a descriptive error on non-2xx", async () => {
    mockFetch({ message: "bad request" }, 400);
    await expect(getGrow()).rejects.toThrow(/Earn API GET \/v0\/grow failed: 400/);
  });
});
