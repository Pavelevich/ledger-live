import { RawApiResponse } from "../entities";

export const getHederaTestnetMockData = () => ({
  cryptoAssets: {
    hedera_testnet: {
      id: "hedera_testnet",
      ticker: "HBAR",
      name: "Hedera",
      assetsIds: {
        hedera_testnet: "hedera_testnet",
      },
    },
  },
  networks: {
    hedera_testnet: {
      id: "hedera_testnet",
      name: "Hedera (Testnet)",
    },
  },
  cryptoOrTokenCurrencies: {
    hedera_testnet: {
      type: "crypto_currency" as const,
      id: "hedera_testnet",
      coinType: 3030,
      name: "Hedera (Testnet)",
      managerAppName: "Hedera",
      ticker: "HBAR",
      scheme: "hedera_testnet",
      color: "#000",
      family: "hedera",
      isTestnetFor: "hedera",
      units: [
        {
          name: "Hedera",
          code: "HBAR",
          magnitude: 8,
        },
      ],
      explorerViews: [
        {
          tx: "https://hashscan.io/testnet/transaction/$hash",
          address: "https://hashscan.io/testnet/account/$address",
        },
      ],
      tokenTypes: ["hts", "erc20"],
    },
  },
});

export function injectHederaMockData(response: RawApiResponse): RawApiResponse {
  const existingMetaCurrencyIds = response.currenciesOrder?.metaCurrencyIds ?? [];
  const hasHederaTestnet = existingMetaCurrencyIds.includes("hedera_testnet");

  if (hasHederaTestnet) {
    return response;
  }

  const hederaTestnetData = getHederaTestnetMockData();

  return {
    ...response,
    cryptoAssets: {
      ...response.cryptoAssets,
      ...hederaTestnetData.cryptoAssets,
    },
    networks: {
      ...response.networks,
      ...hederaTestnetData.networks,
    },
    cryptoOrTokenCurrencies: {
      ...response.cryptoOrTokenCurrencies,
      ...hederaTestnetData.cryptoOrTokenCurrencies,
    },
    currenciesOrder: {
      key: response.currenciesOrder?.key ?? "",
      order: response.currenciesOrder?.order ?? "",
      metaCurrencyIds: ["hedera_testnet", ...existingMetaCurrencyIds],
    },
    markets: response.markets,
  };
}
