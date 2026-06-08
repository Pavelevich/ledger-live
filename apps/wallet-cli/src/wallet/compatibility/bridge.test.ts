import { describe, expect, it } from "bun:test";
import { buildSolanaTransactionModel } from "./bridge";

describe("buildSolanaTransactionModel", () => {
  it("maps send mode to a transfer model carrying the memo", () => {
    const model = buildSolanaTransactionModel({
      family: "solana",
      recipient: "recipientAddr",
      amount: "1 SOL",
      mode: "send",
      memo: "hello",
    });
    expect(model).toEqual({ kind: "transfer", uiState: { memo: "hello" } });
  });

  it("maps stake.createAccount to a stake.createAccount model with the validator", () => {
    const model = buildSolanaTransactionModel({
      family: "solana",
      recipient: "",
      amount: "1 SOL",
      mode: "stake.createAccount",
      validator: "voteAcc123",
    });
    expect(model).toEqual({
      kind: "stake.createAccount",
      uiState: { delegate: { voteAccAddress: "voteAcc123" } },
    });
  });

  it("maps stake.delegate to a stake.delegate model with stake account and validator", () => {
    const model = buildSolanaTransactionModel({
      family: "solana",
      recipient: "",
      amount: "0 SOL",
      mode: "stake.delegate",
      validator: "voteAcc123",
      stakeAccount: "stakeAcc456",
    });
    expect(model).toEqual({
      kind: "stake.delegate",
      uiState: { stakeAccAddr: "stakeAcc456", voteAccAddr: "voteAcc123" },
    });
  });

  it("maps stake.undelegate to a stake.undelegate model with the stake account", () => {
    const model = buildSolanaTransactionModel({
      family: "solana",
      recipient: "",
      amount: "0 SOL",
      mode: "stake.undelegate",
      stakeAccount: "stakeAcc456",
    });
    expect(model).toEqual({
      kind: "stake.undelegate",
      uiState: { stakeAccAddr: "stakeAcc456" },
    });
  });

  it("maps stake.withdraw to a stake.withdraw model with the stake account", () => {
    const model = buildSolanaTransactionModel({
      family: "solana",
      recipient: "",
      amount: "0 SOL",
      mode: "stake.withdraw",
      stakeAccount: "stakeAcc456",
    });
    expect(model).toEqual({
      kind: "stake.withdraw",
      uiState: { stakeAccAddr: "stakeAcc456" },
    });
  });

  it("defaults missing stake/validator fields to empty strings", () => {
    expect(
      buildSolanaTransactionModel({
        family: "solana",
        recipient: "",
        amount: "0 SOL",
        mode: "stake.delegate",
      }),
    ).toEqual({
      kind: "stake.delegate",
      uiState: { stakeAccAddr: "", voteAccAddr: "" },
    });
  });
});
