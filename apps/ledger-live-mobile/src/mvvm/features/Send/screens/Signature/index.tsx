import React from "react";
import { SignatureScreenView } from "./components/SignatureScreenView";
import { useSignatureViewModel } from "./hooks/useSignatureViewModel";

export function SignatureScreen() {
  const {
    account,
    transaction,
    device,
    request,
    deviceInitializationInput,
    signatureIntent,
    isSigningCompleted,
    onIntentJobStateChanged,
    onIntentJobError,
    onUserCancel,
  } = useSignatureViewModel();

  if (
    !account ||
    !transaction ||
    !device ||
    !request ||
    !deviceInitializationInput ||
    !signatureIntent
  ) {
    return null;
  }

  return (
    <SignatureScreenView
      deviceInitializationInput={deviceInitializationInput}
      signatureIntent={signatureIntent}
      isSigningCompleted={isSigningCompleted}
      onIntentJobStateChanged={onIntentJobStateChanged}
      onIntentJobError={onIntentJobError}
      onUserCancel={onUserCancel}
    />
  );
}
