import React, { useCallback } from "react";
import { StyleSheet } from "react-native";
import { Flex, Text } from "@ledgerhq/native-ui";
import { Trans } from "~/context/Locale";
import { ScreenName } from "~/const";
import { TrackScreen } from "~/analytics";
import SafeAreaView from "~/components/SafeAreaView";
import Button from "~/components/Button";
import { useAccountScreen } from "LLM/hooks/useAccountScreen";
import type { SendFundsNavigatorStackParamList } from "~/components/RootNavigator/types/SendFundsNavigator";
import { StackNavigatorProps } from "~/components/RootNavigator/types/helpers";

type Props = StackNavigatorProps<SendFundsNavigatorStackParamList, ScreenName.AleoRecordPicker>;

export default function AleoRecordPicker({ navigation, route }: Props) {
  const { account, parentAccount } = useAccountScreen(route);
  const { transaction } = route.params;

  const onPressContinue = useCallback(() => {
    if (!account) return;

    navigation.navigate(ScreenName.SendAmountCoin, {
      accountId: account.id,
      parentId: parentAccount?.id,
      transaction,
    });
  }, [account, parentAccount?.id, navigation, transaction]);

  if (!account) return null;

  return (
    <SafeAreaView style={styles.root}>
      <TrackScreen category="SendFunds" name="AleoRecordPicker" />
      <Flex flex={1} px={6} pt={6} justifyContent="center" alignItems="center">
        <Flex
          backgroundColor="neutral.c30"
          borderRadius={2}
          p={6}
          alignItems="center"
          justifyContent="center"
          style={styles.placeholderBox}
        >
          <Text variant="h4" fontWeight="semiBold" color="neutral.c100" textAlign="center" mb={4}>
            <Trans i18nKey="aleo.send.recordPicker.placeholder.title" />
          </Text>
          <Text variant="body" color="neutral.c70" textAlign="center">
            <Trans i18nKey="aleo.send.recordPicker.placeholder.description" />
          </Text>
        </Flex>
      </Flex>
      <Flex px={6} pb={4}>
        <Button type="primary" onPress={onPressContinue}>
          <Trans i18nKey="common.continue" />
        </Button>
      </Flex>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  placeholderBox: {
    minHeight: 200,
    width: "100%",
  },
});
