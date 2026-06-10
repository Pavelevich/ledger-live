import React from "react";
import { render, screen } from "tests/testSetup";
import { ABTestingVariants } from "@ledgerhq/types-live";
import ActionContentCards from "~/renderer/screens/dashboard/ActionContentCards";
import { ActionContentCard, LocationContentCard } from "~/types/dynamicContent";

jest.mock("@braze/web-sdk", () =>
  jest
    .requireActual<typeof import("tests/mocks/brazeWebSdk")>("tests/mocks/brazeWebSdk")
    .getBrazeWebSdkJestMock(),
);

const trackingSettings = {
  shareAnalytics: true,
  sharePersonalizedRecommandations: true,
  lastAnalyticsConsentDate: new Date().toISOString(),
  privacyPolicyVersion: 1,
  orderAccounts: "balance|desc",
};

const emptyDynamicContent = {
  desktopCards: [] as unknown[],
  portfolioCards: [],
  bottomPortfolioCards: [],
  notificationsCards: [],
};

function initialStateWithActionCards(actionCards: ActionContentCard[]) {
  return {
    dynamicContent: {
      ...emptyDynamicContent,
      actionCards,
    },
    settings: trackingSettings,
  };
}

describe("ActionContentCards", () => {
  it("renders dismiss link when action cards include secondaryCta", async () => {
    const actionCards: ActionContentCard[] = [
      {
        id: "ac-1",
        title: "Campaign",
        description: "Body",
        mainCta: "Open",
        secondaryCta: "Not interested",
        link: "https://example.com",
        created: null,
        isMock: true,
        location: LocationContentCard.Action,
      },
    ];

    render(<ActionContentCards variant={ABTestingVariants.variantA} />, {
      initialState: initialStateWithActionCards(actionCards),
    });

    expect(await screen.findByText(/not interested/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("omits dismiss link when action cards have no secondaryCta", async () => {
    const actionCards: ActionContentCard[] = [
      {
        id: "ac-2",
        title: "No secondary",
        description: "Body",
        mainCta: "Open only",
        link: "",
        created: null,
        isMock: true,
        location: LocationContentCard.Action,
      },
    ];

    render(<ActionContentCards variant={ABTestingVariants.variantA} />, {
      initialState: initialStateWithActionCards(actionCards),
    });

    expect(await screen.findByRole("button", { name: "Open only" })).toBeInTheDocument();
    expect(screen.queryByText(/not interested/i)).not.toBeInTheDocument();
  });

  it("renders nothing when variant B is requested", () => {
    const actionCards: ActionContentCard[] = [
      {
        id: "ac-3",
        title: "T",
        description: "D",
        mainCta: "M",
        secondaryCta: "S",
        created: null,
        isMock: true,
        location: LocationContentCard.Action,
      },
    ];

    const { container } = render(<ActionContentCards variant={ABTestingVariants.variantB} />, {
      initialState: initialStateWithActionCards(actionCards),
    });

    expect(container.firstChild).toBeNull();
  });
});
