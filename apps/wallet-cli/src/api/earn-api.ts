/**
 * Thin async client for the Ledger Earn backend (https://earn.api.live.ledger.com).
 *
 * Uses the global `fetch` (Bun) rather than `@ledgerhq/live-network`: wallet-cli does not
 * depend on live-network anywhere and keeping the surface tiny avoids dragging extra deps into
 * the Bun `--compile` bundle. Responses are validated with the Zod schemas in earn-api.types.ts.
 *
 * Base URL is configurable via the EARN_API_BASE_URL env var (default below), following the same
 * lightweight `process.env` override convention used elsewhere in wallet-cli config.
 */

import { walletCliDebug } from "../shared/log";
import {
  CurrencyProvidersResponseSchema,
  DefiProductsResponseSchema,
  DefiTransactionResponseSchema,
  EthTxStatusResponseSchema,
  GrowResponseSchema,
  StakesV1ResponseSchema,
  StakesV3ResponseSchema,
  type CurrencyProvidersResponse,
  type DefiApproveRequest,
  type DefiApproveResponse,
  type DefiDepositRequest,
  type DefiDepositResponse,
  type DefiProductsResponse,
  type DefiWithdrawRequest,
  type DefiWithdrawResponse,
  type EthTxStatusResponse,
  type GrowResponse,
  type StakesRequest,
  type StakesV1Response,
  type StakesV3Response,
} from "./earn-api.types";

const DEFAULT_EARN_API_BASE_URL = "https://earn.api.live.ledger.com";

/** Resolved earn API base URL. Override with the EARN_API_BASE_URL env var. */
export function getEarnApiBaseUrl(): string {
  return (process.env.EARN_API_BASE_URL || DEFAULT_EARN_API_BASE_URL).replace(/\/+$/, "");
}

type RequestOptions = {
  method?: "GET" | "POST";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

type EarnResponse = {
  status: number;
  body: unknown;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${getEarnApiBaseUrl()}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function earnRequestWithStatus(
  path: string,
  options: RequestOptions = {},
): Promise<EarnResponse> {
  const { method = "GET", query, body } = options;
  const url = buildUrl(path, query);
  walletCliDebug(`earn-api: ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Earn API ${method} ${path} failed: ${response.status} ${response.statusText}${
        text ? ` — ${text.slice(0, 500)}` : ""
      }`,
    );
  }

  if (!text) return { status: response.status, body: undefined };
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    throw new Error(`Earn API ${method} ${path} returned non-JSON response: ${text.slice(0, 200)}`);
  }
}

async function earnRequest(path: string, options: RequestOptions = {}): Promise<unknown> {
  return (await earnRequestWithStatus(path, options)).body;
}

// ---------------------------------------------------------------------------
// Read endpoints (no auth, no device)
// ---------------------------------------------------------------------------

/** GET /v0/grow?dashboard_supported=true — yield opportunities across all supported networks. */
export async function getGrow(
  params: { dashboardSupported?: boolean } = {},
): Promise<GrowResponse> {
  const raw = await earnRequest("/v0/grow", {
    query: { dashboard_supported: params.dashboardSupported ?? true },
  });
  return GrowResponseSchema.parse(raw);
}

/** GET /v0/currency/{id}/providers — staking providers available for a given currency id. */
export async function getCurrencyProviders(currencyId: string): Promise<CurrencyProvidersResponse> {
  const raw = await earnRequest(`/v0/currency/${encodeURIComponent(currencyId)}/providers`);
  return CurrencyProvidersResponseSchema.parse(raw);
}

/** GET /v1/defi/products — Kiln ERC-4626 vaults (acts as the trusted-vault allowlist, eth only). */
export async function getDefiProducts(): Promise<DefiProductsResponse> {
  const raw = await earnRequest("/v1/defi/products");
  return DefiProductsResponseSchema.parse(raw);
}

/**
 * POST /v1/stakes — positions for a batch of { network, address }.
 * Returns a bare BatchedView[] array. Use `getStakesV3` for the staleness-aware variant.
 */
export async function getStakes(request: StakesRequest): Promise<StakesV1Response> {
  const raw = await earnRequest("/v1/stakes", { method: "POST", body: request });
  return StakesV1ResponseSchema.parse(raw);
}

/** POST /v3/stakes — same as getStakes but wrapped in `{ data, meta:{ is_stale, ... } }`. */
export async function getStakesV3(request: StakesRequest): Promise<StakesV3Response> {
  const raw = await earnRequest("/v3/stakes", { method: "POST", body: request });
  return StakesV3ResponseSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// ETH vault deposit pipeline
// ---------------------------------------------------------------------------

/** POST /v1/defi/approve — prebuilt ERC-20 approve calldata, or 204 when already approved. */
export async function postDefiApprove(request: DefiApproveRequest): Promise<DefiApproveResponse> {
  const { status, body } = await earnRequestWithStatus("/v1/defi/approve", {
    method: "POST",
    body: request,
  });
  if (status === 204) return { status: 204, kind: "no-action" };
  return { status: 200, kind: "transaction", ...DefiTransactionResponseSchema.parse(body) };
}

/** POST /v1/defi/deposit — prebuilt vault deposit calldata + `to`. */
export async function postDefiDeposit(request: DefiDepositRequest): Promise<DefiDepositResponse> {
  const raw = await earnRequest("/v1/defi/deposit", { method: "POST", body: request });
  return DefiTransactionResponseSchema.parse(raw);
}

/** POST /v1/defi/withdraw — prebuilt redeem calldata. */
export async function postDefiWithdraw(
  request: DefiWithdrawRequest,
): Promise<DefiWithdrawResponse> {
  const raw = await earnRequest("/v1/defi/withdraw", { method: "POST", body: request });
  return DefiTransactionResponseSchema.parse(raw);
}

/** GET /v1/defi/eth/transaction/status — poll status of a submitted vault transaction. */
export async function getEthTxStatus(
  params: { txHash?: string; hash?: string } = {},
): Promise<EthTxStatusResponse> {
  const raw = await earnRequest("/v1/defi/eth/transaction/status", {
    query: { tx_hash: params.txHash ?? params.hash },
  });
  return EthTxStatusResponseSchema.parse(raw);
}
