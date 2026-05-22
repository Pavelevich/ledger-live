import React, { useCallback, useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Flex, Text } from "@ledgerhq/native-ui";
import { useTranslation } from "~/context/Locale";
import SectionSeparator from "~/components/SectionSeparator";
import { formatCurrencyUnit } from "@ledgerhq/coin-module-framework/currencies/formatCurrencyUnit";
import { getAccountCurrency } from "@ledgerhq/live-common/account/index";
import type { AleoAccount, Transaction } from "@ledgerhq/coin-aleo/types";
import { TRANSACTION_TYPE } from "@ledgerhq/coin-aleo/constants";
import { isPrivateTransaction } from "@ledgerhq/coin-aleo/logic/utils";
import { initializePrivateProperties } from "../utils";

type BalanceType = "public" | "private";

interface BalanceSelectorProps {
  account: AleoAccount;
  transaction: Transaction;
  onChange: (transaction: Transaction) => void;
}

const PRIVATE_BALANCE_PLACEHOLDER = "***";

export function BalanceSelector({ account, transaction, onChange }: BalanceSelectorProps) {
  const { t } = useTranslation();
  const unit = getAccountCurrency(account).units[0];

  const isPrivateSelected = isPrivateTransaction(transaction);
  const selectedType: BalanceType = isPrivateSelected ? "private" : "public";

  const transparentBalance = account.aleoResources?.transparentBalance ?? account.balance;

  // Always show placeholder for private balance for now
  const formattedPrivateBalance = PRIVATE_BALANCE_PLACEHOLDER;

  const formattedTransparentBalance = formatCurrencyUnit(unit, transparentBalance, {
    showCode: true,
    disableRounding: true,
  });

  const lastSyncDate = useMemo(() => {
    const date = account.aleoResources?.lastPrivateSyncDate;
    if (!date) return null;

    const dateObj = new Date(date);
    const dayStr = dateObj.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = dateObj.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${dayStr} (${timeStr})`;
  }, [account.aleoResources?.lastPrivateSyncDate]);

  const handleSelectPublic = useCallback(() => {
    if (selectedType === "public") return;

    const updatedTransaction: Transaction = {
      ...transaction,
      mode: TRANSACTION_TYPE.TRANSFER_PUBLIC,
      properties: undefined,
    };

    onChange(updatedTransaction);
  }, [transaction, onChange, selectedType]);

  const handleSelectPrivate = useCallback(() => {
    if (selectedType === "private") return;

    const updatedTransaction: Transaction = {
      ...transaction,
      mode: TRANSACTION_TYPE.TRANSFER_PRIVATE,
      properties: initializePrivateProperties(),
    };

    onChange(updatedTransaction);
  }, [transaction, onChange, selectedType]);

  return (
    <View>
      <Flex flexDirection="column" rowGap={4}>
        {/* Label */}
        <Text variant="h5" fontWeight="semiBold" color="neutral.c100" mb={2}>
          {t("aleo.send.balanceSelector.label")}
        </Text>

        {/* Balance Options */}
        <Flex flexDirection="column" rowGap={5}>
          {/* Public Balance Option */}
          <TouchableOpacity
            onPress={handleSelectPublic}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedType === "public" }}
            accessibilityLabel={t("aleo.send.balanceSelector.public")}
            style={[styles.optionButton, selectedType === "public" && styles.optionButtonSelected]}
          >
            <Flex flexDirection="column" p={4} rowGap={1}>
              <Text
                variant="body"
                fontWeight="semiBold"
                color={selectedType === "public" ? "primary.c80" : "neutral.c100"}
              >
                {t("aleo.send.balanceSelector.public")}
              </Text>
              <Text
                variant="large"
                fontWeight="medium"
                color={selectedType === "public" ? "primary.c80" : "neutral.c100"}
                mt={1}
              >
                {formattedTransparentBalance}
              </Text>
            </Flex>
          </TouchableOpacity>

          {/* Private Balance Option */}
          <TouchableOpacity
            onPress={handleSelectPrivate}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedType === "private" }}
            accessibilityLabel={t("aleo.send.balanceSelector.private")}
            style={[styles.optionButton, selectedType === "private" && styles.optionButtonSelected]}
          >
            <Flex flexDirection="column" p={4} rowGap={1}>
              <Text
                variant="body"
                fontWeight="semiBold"
                color={selectedType === "private" ? "primary.c80" : "neutral.c100"}
              >
                {t("aleo.send.balanceSelector.private")}
              </Text>
              <Text
                variant="large"
                fontWeight="medium"
                color={selectedType === "private" ? "primary.c80" : "neutral.c100"}
                mt={1}
              >
                {formattedPrivateBalance}
              </Text>
              {lastSyncDate ? (
                <Text variant="small" color="neutral.c70" mt={1}>
                  {t("aleo.send.balanceSelector.lastSync", { date: lastSyncDate })}
                </Text>
              ) : (
                <Text variant="small" color="neutral.c70" mt={1}>
                  {t("aleo.send.balanceSelector.notSynced")}
                </Text>
              )}
            </Flex>
          </TouchableOpacity>
        </Flex>

        {/* Separator */}
        <SectionSeparator />
      </Flex>
    </View>
  );
}

const styles = StyleSheet.create({
  optionButton: {
    width: "100%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "transparent",
    minHeight: 72,
  },
  optionButtonSelected: {
    borderColor: "#6490F1",
    backgroundColor: "rgba(100, 144, 241, 0.08)",
    borderWidth: 1,
  },
});
