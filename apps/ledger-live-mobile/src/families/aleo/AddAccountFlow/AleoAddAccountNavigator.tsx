import React, { useMemo } from "react";
import { Platform } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "@react-navigation/native";
import { getStackNavigatorConfig } from "~/navigation/navigatorConfig";
import { ScreenName } from "~/const";
import { AleoOnboardAccountParamList, AleoViewKeyFlowParamList } from "./types";
import AleoViewKeyWarningScreen from "./AleoViewKeyWarningScreen";
import AleoViewKeyApproveScreen from "./AleoViewKeyApproveScreen";
import { StackNavigatorProps } from "~/components/RootNavigator/types/helpers";

type Props = StackNavigatorProps<AleoOnboardAccountParamList, ScreenName.AleoOnboardAccount>;

const Stack = createNativeStackNavigator<AleoViewKeyFlowParamList>();

function AleoAddAccountNavigator({ route }: Props) {
  const { colors } = useTheme();
  const stackNavigationConfig = useMemo(() => getStackNavigatorConfig(colors, true), [colors]);

  return (
    <Stack.Navigator
      screenOptions={{
        ...stackNavigationConfig,
        gestureEnabled: Platform.OS === "ios",
      }}
    >
      <Stack.Screen
        name={ScreenName.AleoViewKeyWarning}
        component={AleoViewKeyWarningScreen}
        initialParams={route.params}
        options={{ headerTitle: "" }}
      />
      <Stack.Screen
        name={ScreenName.AleoViewKeyApprove}
        component={AleoViewKeyApproveScreen}
        initialParams={route.params}
        options={{ headerTitle: "" }}
      />
    </Stack.Navigator>
  );
}

const options = {
  headerShown: false,
};
export { AleoAddAccountNavigator as component, options };
export default AleoAddAccountNavigator;
