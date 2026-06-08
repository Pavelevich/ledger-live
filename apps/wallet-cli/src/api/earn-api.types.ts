/**
 * Hand-written Zod schemas + inferred types for the Ledger Earn backend
 * (https://earn.api.live.ledger.com).
 *
 * There is no OpenAPI spec or generated client for this API in the monorepo, so every shape
 * here is modeled from REAL observed responses. Backend payloads frequently carry extra fields
 * (and add new ones over time), so every object schema uses `.passthrough()` to keep unknown
 * fields instead of stripping them, and uncertain fields are marked `.optional()`.
 *
 * Endpoints covered:
 *   - GET  /v0/grow?dashboard_supported=true        -> GrowItem[]
 *   - GET  /v0/currency/{id}/providers              -> CurrencyProvider[]
 *   - GET  /v1/defi/products                         -> DefiProduct[]   (Kiln ERC-4626 vaults, eth)
 *   - POST /v1/stakes  body [{ network, address }]   -> BatchedView[]   (bare array)
 *   - POST /v3/stakes  body [{ network, address }]   -> StakesV3Response ({ data, meta })
 *   - POST /v1/defi/approve                         -> ApproveResponse | 204
 *   - POST /v1/defi/deposit                         -> DepositResponse
 *   - POST /v1/defi/withdraw                        -> WithdrawResponse
 *   - GET  /v1/defi/eth/transaction/status          -> TransactionStatusResponse
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /v0/grow?dashboard_supported=true
// ---------------------------------------------------------------------------

export const GrowInterestSchema = z
  .object({
    // Observed: "APY" | "NRR". Kept as a string so new interest types do not break parsing.
    type: z.string(),
    value: z.string(),
    currency: z.string(),
  })
  .passthrough();
export type GrowInterest = z.infer<typeof GrowInterestSchema>;

export const GrowProviderRefSchema = z
  .object({
    id: z.string(),
    currency: z.string(),
    provider: z.string(),
    receipt_currency: z.string(),
    last_update: z.string(),
  })
  .passthrough();
export type GrowProviderRef = z.infer<typeof GrowProviderRefSchema>;

export const GrowItemSchema = z
  .object({
    provider: z.string(),
    network: z.string(),
    deposit_token: z.string(),
    interest: GrowInterestSchema,
    dashboard_enabled: z.boolean().optional(),
    providers: z.array(GrowProviderRefSchema).optional(),
    // Observed: "Supported". Kept permissive.
    type: z.string().optional(),
  })
  .passthrough();
export type GrowItem = z.infer<typeof GrowItemSchema>;

export const GrowResponseSchema = z.array(GrowItemSchema);
export type GrowResponse = z.infer<typeof GrowResponseSchema>;

// ---------------------------------------------------------------------------
// GET /v0/currency/{id}/providers
// ---------------------------------------------------------------------------

export const CurrencyProviderCategorySchema = z.union([
  z.literal("liquid"),
  z.literal("pooling"),
  z.literal("protocol"),
  z.literal("restaking"),
  // Forward-compatible catch-all for categories not yet known to the CLI.
  z.string(),
]);
export type CurrencyProviderCategory = z.infer<typeof CurrencyProviderCategorySchema>;

export const CurrencyProviderSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    apy: z.number().optional(),
    category: CurrencyProviderCategorySchema,
    icon: z.string(),
    liveAppId: z.string(),
    min: z.number().optional(),
    rewardsStrategy: z.string().optional(),
    rewardsCurrency: z.string().optional(),
    supportLink: z.string().optional(),
    active: z.boolean(),
    queryParams: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
export type CurrencyProvider = z.infer<typeof CurrencyProviderSchema>;

export const CurrencyProvidersResponseSchema = z.array(CurrencyProviderSchema);
export type CurrencyProvidersResponse = z.infer<typeof CurrencyProvidersResponseSchema>;

// ---------------------------------------------------------------------------
// GET /v1/defi/products  (Kiln ERC-4626 vaults — chain "eth" only)
// ---------------------------------------------------------------------------

// Intentionally permissive: the backend returns many protocol-specific fields
// (grr/nrr/protocol_*, additional_rewards, etc.). Only the fields the CLI relies on are typed.
export const DefiProductSchema = z
  .object({
    id: z.string(),
    provided_by: z.string().optional(),
    product_type: z.string().optional(),
    name: z.string().optional(),
    display_name: z.string().optional(),
    description: z.string().optional(),
    chain: z.string().optional(),
    chain_id: z.number().optional(),
    address: z.string().optional(),
    status: z.string().optional(),
    vault_id: z.string().optional(),
    vault: z.string().optional(),
    asset: z.string().optional(),
    asset_symbol: z.string().optional(),
    currency: z.string().optional(),
    asset_decimals: z.number().optional(),
    asset_price_usd: z.number().optional(),
    share_symbol: z.string().optional(),
    tvl: z.string().optional(),
    protocol: z.string().optional(),
  })
  .passthrough();
export type DefiProduct = z.infer<typeof DefiProductSchema>;

export const DefiProductsResponseSchema = z.array(DefiProductSchema);
export type DefiProductsResponse = z.infer<typeof DefiProductsResponseSchema>;

// ---------------------------------------------------------------------------
// POST /v1/stakes and /v3/stakes
// ---------------------------------------------------------------------------

export const StakesRequestEntrySchema = z.object({
  network: z.string(),
  address: z.string(),
  fresh: z.boolean().optional(),
});
export type StakesRequestEntry = z.infer<typeof StakesRequestEntrySchema>;

export const StakesRequestSchema = z.array(StakesRequestEntrySchema);
export type StakesRequest = z.infer<typeof StakesRequestSchema>;

// BatchedView — exact shape is backend-defined and varies per network/provider.
// Kept fully permissive (any object) until a stable contract is confirmed.
export const BatchedViewSchema = z.record(z.string(), z.unknown());
export type BatchedView = z.infer<typeof BatchedViewSchema>;

// POST /v1/stakes -> bare array of BatchedView.
export const StakesV1ResponseSchema = z.array(BatchedViewSchema);
export type StakesV1Response = z.infer<typeof StakesV1ResponseSchema>;

// POST /v3/stakes -> { data: BatchedView[], meta: { is_stale, ... } }.
export const StakesV3MetaSchema = z
  .object({
    is_stale: z.boolean().optional(),
    stale_at: z.string().optional(),
    responded_at: z.string().optional(),
  })
  .passthrough();
export type StakesV3Meta = z.infer<typeof StakesV3MetaSchema>;

export const StakesV3ResponseSchema = z
  .object({
    data: z.array(BatchedViewSchema),
    meta: StakesV3MetaSchema.optional(),
  })
  .passthrough();
export type StakesV3Response = z.infer<typeof StakesV3ResponseSchema>;

// ---------------------------------------------------------------------------
// /v1/defi/* — ETH vault deposit / withdraw pipeline
// ---------------------------------------------------------------------------

export const DefiApproveRequestSchema = z
  .object({
    wallet: z.string(),
    asset: z.string(),
    chain_id: z.number(),
    vault: z.string(),
    amount: z.string(),
    ignore_checks: z.boolean(),
  })
  .passthrough();
export type DefiApproveRequest = z.infer<typeof DefiApproveRequestSchema>;

export const DefiDepositRequestSchema = DefiApproveRequestSchema;
export type DefiDepositRequest = z.infer<typeof DefiDepositRequestSchema>;

export const DefiWithdrawRequestSchema = z
  .object({
    wallet: z.string(),
    chain_id: z.number(),
    vault: z.string(),
    amount: z.string(),
    ignore_checks: z.boolean(),
  })
  .passthrough();
export type DefiWithdrawRequest = z.infer<typeof DefiWithdrawRequestSchema>;

const HexCalldataSchema = z
  .string()
  .regex(/^0x([0-9a-fA-F]{2})*$/, "data must be 0x-prefixed hex with even length");

// Calldata-style responses. The backend returns prebuilt transaction fields under `data`.
export const DefiTransactionDataSchema = z
  .object({
    wallet: z.string(),
    to: z.string(),
    data: HexCalldataSchema,
    value: z.string(),
    nonce: z.number(),
    gas_limit: z.number(),
    chain_id: z.number(),
  })
  .passthrough();
export type DefiTransactionData = z.infer<typeof DefiTransactionDataSchema>;

export const DefiTransactionResponseSchema = z
  .object({
    data: DefiTransactionDataSchema,
  })
  .passthrough();
export type DefiTransactionResponse = z.infer<typeof DefiTransactionResponseSchema>;

export type DefiApproveResponse =
  | ({ status: 200; kind: "transaction" } & DefiTransactionResponse)
  | { status: 204; kind: "no-action" };
export type DefiDepositResponse = DefiTransactionResponse;
export type DefiWithdrawResponse = DefiTransactionResponse;

// GET /v1/defi/eth/transaction/status
export const EthTxStatusSchema = z.union([
  z.literal("error"),
  z.literal("pending_confirmation"),
  z.literal("success"),
  z.literal("unknown"),
]);
export type EthTxStatus = z.infer<typeof EthTxStatusSchema>;

export const EthTxStatusResponseSchema = z
  .object({
    data: z
      .object({
        status: EthTxStatusSchema,
      })
      .passthrough(),
  })
  .passthrough();
export type EthTxStatusResponse = z.infer<typeof EthTxStatusResponseSchema>;
