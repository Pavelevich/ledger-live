import React from "react";
import { render, screen } from "tests/testSetup";
import { TRANSACTION_TYPE } from "@ledgerhq/live-common/families/aleo/constants";
import { isSelfTransferTransaction } from "@ledgerhq/live-common/families/aleo/utils";
import { ALEO_ACCOUNT_1, ALEO_ACCOUNT_2, makeAleoTokenAccount } from "../../../__mocks__/account.mock";
import { makeAleoTransaction } from "../../../__mocks__/transaction.mock";
import StepSummaryRecipientValue from "./StepSummaryRecipientValue";

jest.mock("@ledgerhq/live-common/families/aleo/utils");
jest.mock("~/renderer/components/AccountTagDerivationMode", () => () => (
  <div data-testid="account-tag-derivation-mode" />
));
jest.mock("~/renderer/components/CryptoCurrencyIcon", () => () => (
  <div data-testid="currency-icon" />
));
jest.mock("./StepSummaryAddressBadge", () => () => <div data-testid="recipient-badge" />);

const mockedIsSelfTransferTransaction = jest.mocked(isSelfTransferTransaction);

describe("StepSummaryRecipientValue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render account name and badge for self-transfer recipient", () => {
    mockedIsSelfTransferTransaction.mockReturnValue(true);

    render(
      <StepSummaryRecipientValue
        account={ALEO_ACCOUNT_1}
        parentAccount={undefined}
        transaction={makeAleoTransaction({
          mode: TRANSACTION_TYPE.CONVERT_PRIVATE_TO_PUBLIC,
          recipient: ALEO_ACCOUNT_2.freshAddress,
        })}
      />,
      { initialState: { accounts: [ALEO_ACCOUNT_2] } },
    );

    expect(
      screen.getByText(`${ALEO_ACCOUNT_2.currency.name} ${ALEO_ACCOUNT_2.index + 1}`),
    ).toBeInTheDocument();
    expect(screen.getByTestId("recipient-badge")).toBeInTheDocument();
  });

  it("should render recipient address for regular transfer", () => {
    const recipient = "aleo1recipientaddress";

    mockedIsSelfTransferTransaction.mockReturnValue(false);

    render(
      <StepSummaryRecipientValue
        account={ALEO_ACCOUNT_1}
        parentAccount={undefined}
        transaction={makeAleoTransaction({
          mode: TRANSACTION_TYPE.TRANSFER_PUBLIC,
          recipient,
        })}
      />,
    );

    expect(screen.getByText(recipient)).toBeInTheDocument();
    expect(screen.queryByTestId("recipient-badge")).not.toBeInTheDocument();
  });

  it("should render recipient address for token transfer", () => {
    const recipient = "aleo1tokenrecipient";
    const tokenAccount = makeAleoTokenAccount();

    mockedIsSelfTransferTransaction.mockReturnValue(false);

    render(
      <StepSummaryRecipientValue
        account={tokenAccount}
        parentAccount={ALEO_ACCOUNT_1}
        transaction={makeAleoTransaction({
          mode: TRANSACTION_TYPE.TRANSFER_TOKEN_PUBLIC,
          recipient,
          subAccountId: "token-sub-account",
        })}
      />,
    );

    expect(screen.getByText(recipient)).toBeInTheDocument();
  });
});
