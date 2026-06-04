import { TransportStatusError, UserRefusedOnDevice } from "@ledgerhq/errors";
import type { DeviceConnectionResult, Job } from "@ledgerhq/device-intent";
import { getMainAccount } from "../../account/index";
import { getAccountBridge } from "../../bridge/index";
import { TransactionRefusedOnDevice } from "../../errors";
import type { Device } from "../../hw/actions/types";
import type { SignOperationEvent } from "@ledgerhq/types-live";
import { Observable, type Subscription } from "rxjs";
import type { SignTransactionIntentInput, SignTransactionIntentJobState } from "./types";

function buildDevice(connectionResult: DeviceConnectionResult): Device {
  return {
    deviceId: connectionResult.compatDeviceId,
    deviceName: connectionResult.compatDeviceName,
    modelId: connectionResult.compatDeviceModelId,
    wired: connectionResult.compatDeviceWired,
  };
}

function isUserRefusalError(error: unknown): boolean {
  return (
    error instanceof TransactionRefusedOnDevice ||
    error instanceof UserRefusedOnDevice ||
    (error instanceof TransportStatusError && error.statusCode === 0x6985)
  );
}

function normalizeSignError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function mapSignOperationEvent(
  event: SignOperationEvent,
  device: Device,
): SignTransactionIntentJobState | null {
  switch (event.type) {
    case "signed":
      return { type: "signed", device, signedOperation: event.signedOperation };
    case "device-signature-requested":
      return { type: "device-signature-requested", device };
    case "device-streaming":
      return { type: "device-streaming", device, progress: event.progress };
    case "device-signature-granted":
      return { type: "pending", device };
    default:
      return null;
  }
}

export const signTransactionIntentJob: Job<
  SignTransactionIntentJobState,
  SignTransactionIntentInput
> = ({ deviceConnectionResult, input }) => {
  const device = buildDevice(deviceConnectionResult);
  const mainAccount = getMainAccount(input.account, input.parentAccount ?? undefined);

  return new Observable<SignTransactionIntentJobState>(subscriber => {
    let innerSubscription: Subscription | undefined;
    let runRequestId = 0;

    const run = () => {
      const currentRunRequestId = ++runRequestId;
      innerSubscription?.unsubscribe();
      subscriber.next({ type: "pending", device });

      getAccountBridge(mainAccount)
        .then(bridge => {
          if (subscriber.closed || currentRunRequestId !== runRequestId) {
            return;
          }

          innerSubscription = bridge
            .signOperation({
              account: mainAccount,
              transaction: input.transaction,
              deviceId: device.deviceId,
              deviceModelId: device.modelId,
            })
            .subscribe({
              next: event => {
                const state = mapSignOperationEvent(event, device);
                if (state) {
                  subscriber.next(state);
                }
              },
              // A user refusal is a terminal but non-error outcome: surface a dedicated
              // "cancelled" state (info screen + retry) instead of letting the error escape
              // the observable, which would otherwise trigger the executor's generic error screen.
              error: error => {
                if (isUserRefusalError(error)) {
                  subscriber.next({ type: "cancelled", device, retry: run });
                  return;
                }
                subscriber.error(normalizeSignError(error));
              },
              complete: () => {
                subscriber.complete();
              },
            });
        })
        .catch(error => {
          if (subscriber.closed || currentRunRequestId !== runRequestId) {
            return;
          }

          subscriber.error(normalizeSignError(error));
        });
    };

    run();

    return () => {
      runRequestId += 1;
      innerSubscription?.unsubscribe();
    };
  });
};
