import React, { useState, useCallback } from "react";
import { Flex, Text, Button, SelectableList } from "@ledgerhq/native-ui";
import { useTranslation } from "~/context/Locale";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSelector } from "~/context/hooks";
import { useTheme } from "styled-components/native";
import { accountSelector } from "~/reducers/accounts";
import { TRANSACTION_TYPE } from "@ledgerhq/live-common/families/aleo/constants";
import { NavigatorName, ScreenName } from "~/const";
import BigNumber from "bignumber.js";
import type { AleoAccount } from "@ledgerhq/live-common/families/aleo/types";

type RouteParams = {
  accountId: string;
  parentId?: string;
};

type SelfTransferMode =
  | typeof TRANSACTION_TYPE.CONVERT_PUBLIC_TO_PRIVATE
  | typeof TRANSACTION_TYPE.CONVERT_PRIVATE_TO_PUBLIC;

/**
 * Self-transfer screen for Aleo accounts.
 * Allows converting between public and private balances.
 */
export function AleoSelfTransferScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();

  const { accountId, parentId } = route.params || {};

  const account = useSelector(state => accountSelector(state, { accountId })) as AleoAccount | null;

  const parentAccount = useSelector(state =>
    parentId ? accountSelector(state, { accountId: parentId }) : null,
  );

  const [transactionMode, setTransactionMode] = useState<SelfTransferMode>(
    TRANSACTION_TYPE.CONVERT_PUBLIC_TO_PRIVATE,
  );

  const handleContinue = useCallback(() => {
    if (!account?.freshAddress) {
      return;
    }

    const targetScreen =
      transactionMode === TRANSACTION_TYPE.CONVERT_PRIVATE_TO_PUBLIC
        ? ScreenName.AleoRecordPicker
        : ScreenName.SendSelectRecipient;

    // Navigate to send flow with pre-filled self-transfer transaction.
    // Private -> public must always pass through record picker.
    navigation.navigate(NavigatorName.SendFunds as any, {
      screen: targetScreen,
      params: {
        accountId: account.id,
        parentId: parentAccount?.id,
        transaction: {
          family: "aleo",
          amount: new BigNumber(0),
          useAllAmount: false,
          recipient: account.freshAddress, // Self-transfer: recipient = own address
          fees: new BigNumber(0),
          mode: transactionMode,
          ...(transactionMode === TRANSACTION_TYPE.CONVERT_PRIVATE_TO_PUBLIC
            ? {
                properties: {
                  amountRecordCommitments: [],
                  feeRecordCommitment: null,
                },
              }
            : {}),
        },
      },
    });
  }, [account, parentAccount, transactionMode, navigation]);

  if (!account) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.main }} edges={["bottom"]}>
        <Flex flex={1} justifyContent="center" alignItems="center" px={6}>
          <Text variant="paragraph" color="neutral.c70">
            Account not found
          </Text>
        </Flex>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.main }} edges={["bottom"]}>
      <Flex flex={1} px={6} pt={6}>
        <Text variant="h4" fontWeight="semiBold" color="neutral.c100" mb={2}>
          {t("aleo.selfTransfer.modal.title")}
        </Text>
        <Text variant="body" color="neutral.c70" mb={8}>
          {t("aleo.selfTransfer.modal.stepRecipient.selectLabel")}
        </Text>

        <SelectableList currentValue={transactionMode} onChange={setTransactionMode}>
          <SelectableList.Element value={TRANSACTION_TYPE.CONVERT_PUBLIC_TO_PRIVATE}>
            {t("aleo.selfTransfer.modal.stepRecipient.publicToPrivate")}
          </SelectableList.Element>
          <SelectableList.Element value={TRANSACTION_TYPE.CONVERT_PRIVATE_TO_PUBLIC}>
            {t("aleo.selfTransfer.modal.stepRecipient.privateToPublic")}
          </SelectableList.Element>
        </SelectableList>

        <Flex flex={1} />

        <Flex mb={6}>
          <Button type="main" size="large" onPress={handleContinue}>
            {t("common.continue")}
          </Button>
        </Flex>
      </Flex>
    </SafeAreaView>
  );
}
