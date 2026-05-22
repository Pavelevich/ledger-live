import React from "react";
import type { Account, ResolvedAccountBridge, TransactionCommon } from "@ledgerhq/types-live";
import { IconsLegacy } from "@ledgerhq/native-ui";
import { Trans } from "~/context/Locale";
import type { ParamListBase, RouteProp } from "@react-navigation/native";
import type { AleoAccount } from "@ledgerhq/live-common/families/aleo/types";
import { NavigatorName, ScreenName } from "~/const";
import type { ActionButtonEvent } from "~/components/FabActions";

const getMainActions = <T extends TransactionCommon>({
  account,
  parentAccount,
  parentRoute,
  bridge,
}: {
  account: AleoAccount;
  parentAccount?: Account;
  parentRoute: RouteProp<ParamListBase, ScreenName>;
  bridge: ResolvedAccountBridge<T>;
}): ActionButtonEvent[] => {
  const isAccountEmpty = bridge.isAccountEmpty(account);

  return [
    {
      id: "aleo-self-transfer",
      navigationParams: [
        NavigatorName.Base,
        {
          screen: ScreenName.AleoSelfTransfer,
          params: {
            accountId: account.id,
            parentId: parentAccount?.id,
            source: parentRoute,
          },
        },
      ],
      label: <Trans i18nKey="aleo.accountActions.selfTransfer.button" />,
      Icon: IconsLegacy.ArrowFromBottomMedium,
      disabled: isAccountEmpty,
      eventProperties: {
        currency: "aleo",
        button: "aleo-self-transfer",
      },
    },
  ];
};

export default {
  getMainActions,
};
