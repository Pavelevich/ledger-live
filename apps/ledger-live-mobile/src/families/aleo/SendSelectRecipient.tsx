import React from "react";
import type { Account } from "@ledgerhq/types-live";
import type {
  Transaction as AleoTransaction,
  TransactionStatus,
} from "@ledgerhq/live-common/families/aleo/types";
import type { Transaction } from "@ledgerhq/live-common/generated/types";
import { Box } from "@ledgerhq/native-ui";
import { TRANSACTION_TYPE } from "@ledgerhq/live-common/families/aleo/constants";
import { ScreenName } from "~/const";
import { BalanceSelector } from "./send/components/BalanceSelector";

interface StepRecipientExtraContentProps {
  account: Account;
  parentAccount?: Account | null;
  transaction: Transaction;
  status: TransactionStatus;
  setTransaction: (transaction: Transaction) => void;
}

interface RecipientNextStepContext {
  transaction: Transaction;
}

/**
 * Aleo-specific UI that appears at the very beginning of the send flow.
 * Shows the balance selector for choosing between public/private balance.
 */
function StepRecipientExtraContent({
  account,
  transaction,
  setTransaction,
}: StepRecipientExtraContentProps) {
  if (transaction.family !== "aleo") {
    return null;
  }

  const isSelfTransferMode =
    transaction.mode === TRANSACTION_TYPE.CONVERT_PUBLIC_TO_PRIVATE ||
    transaction.mode === TRANSACTION_TYPE.CONVERT_PRIVATE_TO_PUBLIC;

  if (isSelfTransferMode) {
    return null;
  }

  const handleBalanceChange = (updatedTransaction: AleoTransaction) => {
    setTransaction(updatedTransaction);
  };

  return (
    <Box px={2} pt={2}>
      <BalanceSelector account={account} transaction={transaction} onChange={handleBalanceChange} />
    </Box>
  );
}

function getNextRecipientStep({ transaction }: RecipientNextStepContext) {
  if (transaction.family !== "aleo") {
    return null;
  }

  if (
    transaction.mode !== TRANSACTION_TYPE.TRANSFER_PRIVATE &&
    transaction.mode !== TRANSACTION_TYPE.CONVERT_PRIVATE_TO_PUBLIC
  ) {
    return null;
  }

  return ScreenName.AleoRecordPicker;
}

export default {
  StepRecipientExtraContent,
  getNextRecipientStep,
};
