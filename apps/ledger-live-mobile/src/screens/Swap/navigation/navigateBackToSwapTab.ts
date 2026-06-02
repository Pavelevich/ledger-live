import { CommonActions } from "@react-navigation/native";
import { NavigatorName, ScreenName } from "~/const";

type NavigationStateWithRouteNames = {
  routeNames?: string[];
};

type NavigationWithState = {
  dispatch(action: ReturnType<typeof CommonActions.reset>): void;
  getState(): NavigationStateWithRouteNames | undefined;
  getParent():
    | {
        dispatch(action: ReturnType<typeof CommonActions.reset>): void;
        goBack(): void;
      }
    | undefined;
  goBack(): void;
};

type BeforeRemoveEvent = {
  preventDefault(): void;
  data: {
    action: {
      payload?: unknown;
    };
  };
};

export function hasSwapTabRoute(state: NavigationStateWithRouteNames | undefined) {
  const routeNames = state?.routeNames;
  return Array.isArray(routeNames) && routeNames.includes(ScreenName.SwapTab);
}

function getResetToLegacySwapAction() {
  // Legacy Swap lives outside Main in the base stack, but we still need Main
  // underneath it so the Swap form back button returns to home instead of
  // leaving Swap as a dead-end root route.
  return CommonActions.reset({
    index: 1,
    routes: [
      {
        name: NavigatorName.Main,
      },
      {
        name: NavigatorName.Swap,
        params: {
          screen: ScreenName.SwapTab,
        },
      },
    ],
  });
}

export function navigateBackToSwapTab({
  navigation,
  shouldDisplayWallet40MainNav,
}: {
  navigation: NavigationWithState;
  shouldDisplayWallet40MainNav: boolean;
}) {
  if (hasSwapTabRoute(navigation.getState())) {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: ScreenName.SwapTab }],
      }),
    );
    return;
  }

  const parentNavigation = navigation.getParent();

  if (!parentNavigation) {
    navigation.goBack();
    return;
  }

  if (!shouldDisplayWallet40MainNav) {
    parentNavigation.dispatch(getResetToLegacySwapAction());
    return;
  }

  // Wallet 4.0: the Swap sub-screens navigator is pushed on top of Main, which
  // is already on the Swap tab, so popping it returns there. We use goBack
  // rather than a reset so the transition plays the natural back (pop)
  // animation; a reset replays the forward (push) animation and the screen
  // slides out the wrong way. See LIVE-28498.
  parentNavigation.goBack();
}

export function isGoingToSwapHistory(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("routes" in payload)) {
    return false;
  }

  const routes = payload.routes;

  if (!Array.isArray(routes)) {
    return false;
  }

  return routes.some(route => route?.name === ScreenName.SwapHistory);
}

export function handlePendingOperationBeforeRemove({
  event,
  allowRemovalRef,
  navigation,
  shouldDisplayWallet40MainNav,
  onFlowCompleted,
}: {
  event: BeforeRemoveEvent;
  allowRemovalRef: { current: boolean };
  navigation: NavigationWithState;
  shouldDisplayWallet40MainNav: boolean;
  onFlowCompleted: () => void;
}) {
  if (allowRemovalRef.current || isGoingToSwapHistory(event.data.action.payload)) {
    return;
  }

  event.preventDefault();
  allowRemovalRef.current = true;
  onFlowCompleted();
  navigateBackToSwapTab({
    navigation,
    shouldDisplayWallet40MainNav,
  });
}
