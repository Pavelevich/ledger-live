import React, { useCallback } from "react";
import { Linking, StyleSheet } from "react-native";
import { Button, Flex, Icons, Text } from "@ledgerhq/native-ui";
import { useTheme } from "styled-components/native";
import { urls } from "~/utils/urls";
import { useTranslation } from "~/context/Locale";
import { useLocalizedUrl } from "LLM/hooks/useLocalizedUrls";

function NoAssociatedAccounts() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const learnMoreUrl = useLocalizedUrl(urls.aleo.learnMore);

  const onPress = useCallback(() => {
    Linking.openURL(learnMoreUrl);
  }, [learnMoreUrl]);

  return (
    <>
      <Flex flex={1} alignSelf="stretch" alignItems="center">
        <Text style={styles.title}>{t("aleo.noAssociatedAccounts.title")}</Text>

        <Text style={styles.desc} color="neutral.c70">
          {t("aleo.noAssociatedAccounts.description")}
        </Text>
      </Flex>
      <Button
        size="large"
        type="shade"
        testID="button-create-account"
        Icon={() => <Icons.ExternalLink color={colors.neutral.c20} size="S" />}
        onPress={onPress}
      >
        {t("aleo.noAssociatedAccounts.link")}
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    flexWrap: "wrap",
  },
  title: {
    marginTop: 32,
    fontSize: 24,
    textAlign: "center",
    width: "100%",
    fontWeight: 600,
    fontStyle: "normal",
    lineHeight: 32.4,
    letterSpacing: 0.75,
  },
  desc: {
    marginTop: 16,
    marginBottom: 32,
    fontSize: 14,
    width: "100%",
    lineHeight: 23.8,
    fontWeight: 500,
    textAlign: "center",
    alignSelf: "stretch",
  },
  cta: {
    textTransform: "capitalize",
  },
});

export default NoAssociatedAccounts;
