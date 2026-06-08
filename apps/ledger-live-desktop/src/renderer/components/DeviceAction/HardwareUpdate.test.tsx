import React from "react";
import { render, screen, fireEvent } from "tests/testSetup";
import { HardwareUpdate } from "./rendering";
import { track, trackPage } from "~/renderer/analytics/segment";
import { openURL } from "~/renderer/linking";

jest.mock("~/renderer/analytics/segment", () => ({
  track: jest.fn(),
  trackPage: jest.fn(),
  useTrack: () => jest.fn(),
}));

jest.mock("~/renderer/linking", () => ({
  openURL: jest.fn(),
}));

const EXPLORE_LABEL = "Explore compatible devices";
const SWAP_PROVIDER_LABEL = "Swap with another provider";

describe("HardwareUpdate - Nano S swap incompatibility analytics", () => {
  beforeEach(() => jest.clearAllMocks());

  it("tracks the page view with the provider variant", () => {
    render(
      <HardwareUpdate
        i18nKeyTitle="swap.wrongDevice.title"
        i18nKeyDescription="swap.wrongDevice.description"
        variant="provider"
        provider="thorswap"
      />,
    );

    expect(trackPage).toHaveBeenCalledWith(
      "Swap Nano S Incompatibility",
      undefined,
      expect.objectContaining({
        flow: "swap",
        deviceModel: "nanoS",
        variant: "provider",
        provider: "thorswap",
      }),
      true,
      true,
      false,
    );
  });

  it("tracks the explore compatible devices CTA", () => {
    render(
      <HardwareUpdate
        i18nKeyTitle="swap.wrongDevice.title"
        i18nKeyDescription="swap.wrongDevice.description"
        variant="provider"
        provider="thorswap"
      />,
    );

    fireEvent.click(screen.getByText(EXPLORE_LABEL));

    expect(track).toHaveBeenCalledWith("button_clicked", {
      button: "Explore compatible devices",
      page: "Swap Nano S Incompatibility",
      flow: "swap",
      deviceModel: "nanoS",
      variant: "provider",
      provider: "thorswap",
    });
    expect(openURL).toHaveBeenCalledWith("https://shop.ledger.com/pages/hardware-wallet");
  });

  it("tracks the swap with another provider CTA", () => {
    render(
      <HardwareUpdate
        i18nKeyTitle="swap.wrongDevice.title"
        i18nKeyDescription="swap.wrongDevice.description"
        variant="provider"
        provider="thorswap"
      />,
    );

    fireEvent.click(screen.getByText(SWAP_PROVIDER_LABEL));

    expect(track).toHaveBeenCalledWith("button_clicked", {
      button: "Swap with another provider",
      page: "Swap Nano S Incompatibility",
      flow: "swap",
      deviceModel: "nanoS",
      variant: "provider",
      provider: "thorswap",
    });
  });

  it("tracks the currency variant without a provider", () => {
    render(
      <HardwareUpdate
        i18nKeyTitle="swap.incompatibility.ton_title"
        i18nKeyDescription="swap.incompatibility.ton_description"
        variant="currency"
      />,
    );

    expect(trackPage).toHaveBeenCalledWith(
      "Swap Nano S Incompatibility",
      undefined,
      expect.objectContaining({
        flow: "swap",
        deviceModel: "nanoS",
        variant: "currency",
      }),
      true,
      true,
      false,
    );
    expect(trackPage).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ provider: expect.anything() }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});
