import React, { useCallback, useMemo } from "react";
import { useRoute, useNavigation } from "@react-navigation/native";
import { DomainServiceProvider } from "@ledgerhq/domain-service/hooks/index";
import type { Account, AccountLike } from "@ledgerhq/types-live";
import { getMainAccount } from "@ledgerhq/live-common/account/helpers";
import {
  SEND_FLOW_STEP,
  type SendFlowStep,
  type SendFlowInitParams,
} from "@ledgerhq/live-common/flows/send/types";
import type { StepRegistry } from "@ledgerhq/live-common/flows/wizard/types";

import { SendFlowOrchestrator } from "./SendFlowOrchestrator";
import { SEND_FLOW_CONFIG } from "./constants";

import { RecipientScreen } from "./screens/Recipient";
import { AmountScreen } from "./screens/Amount";
import { ConfirmationScreen } from "./screens/Confirmation";
import { SignatureScreen } from "./screens/Signature";
import { CoinControlScreen } from "./screens/CoinControl";
import { aleoSendStepRegistry } from "~/families/aleo/send";

const baseStepRegistry: StepRegistry<SendFlowStep> = {
  [SEND_FLOW_STEP.RECIPIENT]: RecipientScreen,
  [SEND_FLOW_STEP.RECENT_HISTORY]: () => <></>,
  [SEND_FLOW_STEP.AMOUNT]: AmountScreen,
  [SEND_FLOW_STEP.CUSTOM_FEES]: () => <></>,
  [SEND_FLOW_STEP.COIN_CONTROL]: CoinControlScreen,
  [SEND_FLOW_STEP.SIGNATURE]: SignatureScreen,
  [SEND_FLOW_STEP.CONFIRMATION]: ConfirmationScreen,
};

const perFamilyStepRegistry: Partial<Record<string, Partial<StepRegistry<SendFlowStep>>>> = {
  aleo: aleoSendStepRegistry,
};

const hasFamilyStepRegistry = (family: string): family is keyof typeof perFamilyStepRegistry => {
  return family in perFamilyStepRegistry;
};

type SendWorkflowParams = Readonly<{
  account?: AccountLike;
  parentAccount?: Account;
  recipient?: string;
  amount?: string;
  memo?: string;
  fromMAD?: boolean;
}>;

type SendWorkflowRouteParams = {
  onClose?: () => void;
  params?: SendWorkflowParams;
  // Support flattened params from FabActions
  account?: AccountLike;
  parentAccount?: Account;
  recipient?: string;
  amount?: string;
  memo?: string;
  fromMAD?: boolean;
};

const isSendWorkflowRouteParams = (value: unknown): value is SendWorkflowRouteParams => {
  return typeof value === "object" && value !== null;
};

export default function SendWorkflow() {
  const route = useRoute();
  const navigation = useNavigation();

  const routeParams = isSendWorkflowRouteParams(route.params) ? route.params : undefined;

  const { onClose, params } = routeParams || {};

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      navigation.goBack();
    }
  }, [onClose, navigation]);

  // Support both nested params (params.account) and flattened params (account)
  const initParams: SendFlowInitParams = useMemo(
    () => ({
      account: params?.account ?? routeParams?.account,
      parentAccount: params?.parentAccount ?? routeParams?.parentAccount,
      recipient: params?.recipient ?? routeParams?.recipient,
      amount: params?.amount ?? routeParams?.amount,
      memo: params?.memo ?? routeParams?.memo,
      fromMAD: params?.fromMAD ?? routeParams?.fromMAD ?? false,
    }),
    [params, routeParams],
  );

  // Merge base steps with optional family-specific overrides.
  const stepRegistry = useMemo(() => {
    const account = initParams.account;

    if (!account) {
      return baseStepRegistry;
    }

    const mainAccount = getMainAccount(account, initParams.parentAccount);
    const family = mainAccount.currency.family;

    if (!family || !hasFamilyStepRegistry(family)) {
      return baseStepRegistry;
    }

    return {
      ...baseStepRegistry,
      ...perFamilyStepRegistry[family],
    };
  }, [initParams.account, initParams.parentAccount]);

  return (
    <DomainServiceProvider>
      <React.Suspense fallback={null}>
        <SendFlowOrchestrator
          initParams={initParams}
          onClose={handleClose}
          stepRegistry={stepRegistry}
          flowConfig={SEND_FLOW_CONFIG}
        />
      </React.Suspense>
    </DomainServiceProvider>
  );
}
