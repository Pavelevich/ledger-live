import BigNumber from "bignumber.js";
import type {
  MemoNotSupported,
  TransactionIntent,
  TxDataNotSupported,
} from "@ledgerhq/coin-module-framework/api/types";
import type { TRANSACTION_TYPE } from "../constants";
import type {
  AleoRecordScannerStatusResponse,
  AleoPublicTransactionDetailsResponse,
  AleoPrivateRecord,
} from "./api";
import type { AleoDecryptedRecordResponse } from "./sdk";

export interface AleoUnspentRecord extends AleoPrivateRecord {
  microcredits: string;
  decryptedData: AleoDecryptedRecordResponse;
}

export interface AleoPrivateTokenBalance {
  /** Token sub-account id (encodeTokenAccountId result). */
  id: string;
  /** Contract address — token_id for registry tokens, program_name for custom tokens. */
  contractAddress: string;
  /** Sum of token amounts from all unspent private records. */
  balance: BigNumber;
  /** Unspent private records whose amounts contribute to balance. */
  unspentRecords: AleoPrivateRecord[];
}

export type EnrichedPrivateRecord = {
  rawRecord: AleoPrivateRecord;
  details: AleoPublicTransactionDetailsResponse;
  sender: string;
  recipient: string;
  value: BigNumber;
};

export interface ProvableApi {
  uuid?: string;
  scannerStatus?: AleoRecordScannerStatusResponse;
}

export type RecordPickingStrategy = "manual" | "auto";

export type TransactionType = (typeof TRANSACTION_TYPE)[keyof typeof TRANSACTION_TYPE];

export type AleoTransactionIntentData =
  | TxDataNotSupported
  | {
      type: typeof TRANSACTION_TYPE.TRANSFER_PRIVATE;
      records: AleoDecryptedRecordResponse[];
    }
  | {
      type: typeof TRANSACTION_TYPE.CONVERT_PRIVATE_TO_PUBLIC;
      records: AleoDecryptedRecordResponse[];
    }
  | {
      type: "fee_public";
      priorityFee?: bigint;
      executionId: string;
    }
  | {
      type: "fee_private";
      priorityFee?: bigint;
      executionId: string;
      record: AleoDecryptedRecordResponse;
    };

export type AleoTransactionIntent = TransactionIntent<MemoNotSupported, AleoTransactionIntentData>;

export interface SignedAleoTransaction {
  authorization: string;
  feeAuthorization: string | null;
}
