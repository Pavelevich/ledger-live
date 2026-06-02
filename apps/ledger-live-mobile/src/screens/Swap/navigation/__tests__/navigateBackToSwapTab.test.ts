import { CommonActions } from "@react-navigation/native";
import { NavigatorName, ScreenName } from "~/const";
import {
  handlePendingOperationBeforeRemove,
  hasSwapTabRoute,
  navigateBackToSwapTab,
} from "../navigateBackToSwapTab";

const createNavigation = ({
  routeNames = [],
  parentNavigation,
}: {
  routeNames?: string[];
  parentNavigation?: { dispatch: jest.Mock; goBack: jest.Mock } | undefined;
}) => {
  const dispatch = jest.fn();
  const goBack = jest.fn();

  return {
    navigation: {
      dispatch,
      getState: () => ({ routeNames }) as const,
      getParent: () => parentNavigation,
      goBack,
    },
    dispatch,
    goBack,
  };
};

describe("navigateBackToSwapTab", () => {
  it("should detect when the current navigator contains SwapTab", () => {
    expect(hasSwapTabRoute({ routeNames: [ScreenName.SwapTab] } as const)).toBe(true);
    expect(hasSwapTabRoute({ routeNames: [ScreenName.SwapHistory] } as const)).toBe(false);
  });

  it("should reset locally to SwapTab when the current navigator contains SwapTab", () => {
    const { navigation, dispatch, goBack } = createNavigation({
      routeNames: [ScreenName.SwapTab, ScreenName.SwapHistory],
    });

    navigateBackToSwapTab({
      navigation,
      shouldDisplayWallet40MainNav: true,
    });

    expect(dispatch).toHaveBeenCalledWith(
      CommonActions.reset({
        index: 0,
        routes: [{ name: ScreenName.SwapTab }],
      }),
    );
    expect(goBack).not.toHaveBeenCalled();
  });

  it("should go back through the parent navigation in Wallet40", () => {
    const parentDispatch = jest.fn();
    const parentGoBack = jest.fn();
    const { navigation, dispatch, goBack } = createNavigation({
      routeNames: [ScreenName.SwapHistory],
      parentNavigation: { dispatch: parentDispatch, goBack: parentGoBack },
    });

    navigateBackToSwapTab({
      navigation,
      shouldDisplayWallet40MainNav: true,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(goBack).not.toHaveBeenCalled();
    expect(parentDispatch).not.toHaveBeenCalled();
    expect(parentGoBack).toHaveBeenCalledTimes(1);
  });

  it("should reset root navigation to Swap in legacy flow", () => {
    const parentDispatch = jest.fn();
    const parentGoBack = jest.fn();
    const { navigation, dispatch } = createNavigation({
      routeNames: [ScreenName.SwapHistory],
      parentNavigation: { dispatch: parentDispatch, goBack: parentGoBack },
    });

    navigateBackToSwapTab({
      navigation,
      shouldDisplayWallet40MainNav: false,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(parentDispatch).toHaveBeenCalledWith(
      CommonActions.reset({
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
      }),
    );
    expect(parentGoBack).not.toHaveBeenCalled();
  });

  it("should fallback to goBack when no parent navigation exists", () => {
    const { navigation, dispatch, goBack } = createNavigation({
      routeNames: [ScreenName.SwapHistory],
    });

    navigateBackToSwapTab({
      navigation,
      shouldDisplayWallet40MainNav: true,
    });

    expect(dispatch).not.toHaveBeenCalled();
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it("should redirect native back from swap success to SwapTab", () => {
    const parentDispatch = jest.fn();
    const parentGoBack = jest.fn();
    const { navigation } = createNavigation({
      routeNames: [ScreenName.SwapLoading, ScreenName.SwapPendingOperation],
      parentNavigation: { dispatch: parentDispatch, goBack: parentGoBack },
    });
    const allowRemovalRef = { current: false };
    const preventDefault = jest.fn();
    const onFlowCompleted = jest.fn();

    handlePendingOperationBeforeRemove({
      event: {
        preventDefault,
        data: {
          action: CommonActions.goBack(),
        },
      },
      allowRemovalRef,
      navigation,
      onFlowCompleted,
      shouldDisplayWallet40MainNav: true,
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(allowRemovalRef.current).toBe(true);
    expect(onFlowCompleted).toHaveBeenCalledTimes(1);
    expect(parentDispatch).not.toHaveBeenCalled();
    expect(parentGoBack).toHaveBeenCalledTimes(1);
  });

  it("should allow the redirected swap success removal", () => {
    const parentDispatch = jest.fn();
    const parentGoBack = jest.fn();
    const { navigation } = createNavigation({
      routeNames: [ScreenName.SwapLoading, ScreenName.SwapPendingOperation],
      parentNavigation: { dispatch: parentDispatch, goBack: parentGoBack },
    });
    const allowRemovalRef = { current: true };
    const preventDefault = jest.fn();
    const onFlowCompleted = jest.fn();

    handlePendingOperationBeforeRemove({
      event: {
        preventDefault,
        data: {
          action: CommonActions.goBack(),
        },
      },
      allowRemovalRef,
      navigation,
      onFlowCompleted,
      shouldDisplayWallet40MainNav: true,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(onFlowCompleted).not.toHaveBeenCalled();
    expect(parentDispatch).not.toHaveBeenCalled();
    expect(parentGoBack).not.toHaveBeenCalled();
  });

  it("should allow swap success to navigate to history", () => {
    const parentDispatch = jest.fn();
    const parentGoBack = jest.fn();
    const { navigation } = createNavigation({
      routeNames: [ScreenName.SwapLoading, ScreenName.SwapPendingOperation],
      parentNavigation: { dispatch: parentDispatch, goBack: parentGoBack },
    });
    const allowRemovalRef = { current: false };
    const preventDefault = jest.fn();
    const onFlowCompleted = jest.fn();

    handlePendingOperationBeforeRemove({
      event: {
        preventDefault,
        data: {
          action: CommonActions.reset({
            index: 0,
            routes: [{ name: ScreenName.SwapHistory }],
          }),
        },
      },
      allowRemovalRef,
      navigation,
      onFlowCompleted,
      shouldDisplayWallet40MainNav: true,
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(allowRemovalRef.current).toBe(false);
    expect(onFlowCompleted).not.toHaveBeenCalled();
    expect(parentDispatch).not.toHaveBeenCalled();
    expect(parentGoBack).not.toHaveBeenCalled();
  });
});
