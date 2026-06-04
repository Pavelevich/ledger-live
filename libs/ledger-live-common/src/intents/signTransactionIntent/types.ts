import type { Intent, IntentDefinition, IntentPlatformDefinition } from "@ledgerhq/device-intent";
import type { SignatureRequest } from "../../flows/send/hooks/useSendFlowSignatureCore";
import type { Device } from "../../hw/actions/types";
import type { SignedOperation } from "@ledgerhq/types-live";

export type SignTransactionIntentJobState =
  | { type: "pending"; device: Device }
  | { type: "device-signature-requested"; device: Device }
  | { type: "device-streaming"; device: Device; progress: number }
  | { type: "signed"; device: Device; signedOperation: SignedOperation }
  | { type: "cancelled"; device: Device; retry: () => void };

export type SignTransactionIntentInput = SignatureRequest;

export type SignTransactionIntentDefinition = IntentDefinition<
  SignTransactionIntentJobState,
  SignTransactionIntentInput
>;

export type SignTransactionIntentPlatformDefinition<ExtraProps = undefined> =
  IntentPlatformDefinition<SignTransactionIntentJobState, SignTransactionIntentInput, ExtraProps>;

export type SignTransactionIntent<ExtraProps = undefined> = Intent<
  SignTransactionIntentJobState,
  SignTransactionIntentInput,
  ExtraProps
>;
