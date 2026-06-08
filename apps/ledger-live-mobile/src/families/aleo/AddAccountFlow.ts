import { NavigatorName, ScreenName } from "~/const";
import type { AddAccountFlowHandlers } from "LLM/features/Accounts/screens/AddAccount/addAccountFlowContract";

const handlers: AddAccountFlowHandlers = {
  onDeviceConnected: ({ navigation, currency, device, routeParams }) => {
    navigation.navigate(NavigatorName.AddAccounts, {
      screen: ScreenName.AleoAddAccount,
      params: {
        currency,
        device,
        context: routeParams.context,
        onCloseNavigation: routeParams.onCloseNavigation,
        navigationDepth: routeParams.navigationDepth,
        inline: routeParams.inline,
        onSuccess: routeParams.onSuccess,
      },
    });
  },

  onImportAccounts: ({ navigation, currency, device, accountsToAdd, routeParams }) => {
    navigation.replace(ScreenName.AleoAddAccount, {
      accountsToAdd,
      currency,
      device,
      context: routeParams.context,
      onCloseNavigation: routeParams.onCloseNavigation,
      navigationDepth: routeParams.navigationDepth,
      inline: routeParams.inline,
      returnToSwap: routeParams.returnToSwap,
      onSuccess: routeParams.onSuccess,
      initialRoute: ScreenName.AleoViewKeyApprove,
    });
  },
};

export default handlers;
