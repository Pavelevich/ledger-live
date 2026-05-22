import React, { useCallback, useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import { getAccountCurrency } from "@ledgerhq/live-common/account/index";
import type { CryptoOrTokenCurrency } from "@ledgerhq/types-cryptoassets";
import { Box, Button } from "@ledgerhq/native-ui";
import type { AleoAccount, Transaction } from "@ledgerhq/live-common/families/aleo/types";
import { TRANSACTION_TYPE } from "@ledgerhq/live-common/families/aleo/constants";
import { ScreenName } from "~/const";
import type { BaseNavigatorStackParamList } from "~/components/RootNavigator/types/BaseNavigator";
import { useSendFlowActions, useSendFlowData } from "~/mvvm/features/Send/context/SendFlowContext";
import type { SendFlowNavigationProp } from "~/mvvm/features/Send/types";
import { SendFlowLayout } from "~/mvvm/features/Send/components/SendFlowLayout";
import { RecipientScreenView } from "~/mvvm/features/Send/screens/Recipient/components/RecipientScreenView";
import { BalanceSelector } from "../components/BalanceSelector";

/**
 * Aleo-specific Recipient screen with a self-transfer shortcut before recipient input.
 */
export function AleoRecipientScreen() {
  const { t } = useTranslation();
  const { state, uiConfig, recipientSearch } = useSendFlowData();
  const { transaction } = useSendFlowActions();
  const navigation = useNavigation<SendFlowNavigationProp>();

  const account = state.account.account as AleoAccount | null;
  const parentAccount = state.account.parentAccount;
  const txn = state.transaction.transaction as Transaction | null;

  const currency: CryptoOrTokenCurrency | null = useMemo(() => {
    if (state.account.currency) return state.account.currency;
    return account ? getAccountCurrency(account) : null;
  }, [state.account.currency, account]);

  const handleAddressSelected = useCallback(
    (address: string, ensName?: string) => {
      transaction.setRecipient({
        address,
        ensName,
      });

      recipientSearch.clear();
      navigation.navigate(ScreenName.SendFlowAmount);
    },
    [transaction, recipientSearch, navigation],
  );

  const handleSelfTransferPress = useCallback(() => {
    const parentNavigation =
      navigation.getParent<NativeStackNavigationProp<BaseNavigatorStackParamList>>();
    parentNavigation?.navigate(ScreenName.AleoSelfTransfer);
  }, [navigation]);

  if (!account || !currency) {
    return null;
  }

  const isSelfTransferMode =
    txn?.mode === TRANSACTION_TYPE.CONVERT_PUBLIC_TO_PRIVATE ||
    txn?.mode === TRANSACTION_TYPE.CONVERT_PRIVATE_TO_PUBLIC;

  const handleBalanceChange = useCallback(
    (updatedTransaction: Transaction) => {
      transaction.setTransaction(updatedTransaction);
    },
    [transaction],
  );

  return (
    <>
      <SendFlowLayout>
        {txn && !isSelfTransferMode ? (
          <Box px={2} mb={4}>
            <BalanceSelector account={account} transaction={txn} onChange={handleBalanceChange} />
          </Box>
        ) : null}

        <Box px={6}>
          <Button type="shade" size="large" outline onPress={handleSelfTransferPress}>
            {t("aleo.send.selfTransfer.button")}
          </Button>
        </Box>
      </SendFlowLayout>

      <RecipientScreenView
        account={account}
        parentAccount={parentAccount}
        currency={currency}
        onAddressSelected={handleAddressSelected}
        recipientSupportsDomain={uiConfig.recipientSupportsDomain}
      />
    </>
  );
}
