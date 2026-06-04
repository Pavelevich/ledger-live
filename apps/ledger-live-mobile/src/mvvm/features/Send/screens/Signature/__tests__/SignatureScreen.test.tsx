import React from "react";
import { DeviceModelId } from "@ledgerhq/types-devices";
import { render, screen } from "@tests/test-renderer";
import { SignatureScreen } from "../index";
import * as UseSignatureViewModelModule from "../hooks/useSignatureViewModel";

const mockDeviceIntentExecutorLWM = jest.fn();

jest.mock(
  "@ledgerhq/live-common/firebase/featureFlags",
  () => ({
    getFeature: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  "@features/platform-feature-flags",
  () => ({
    formatToFirebaseFeatureId: (featureId: string) => featureId,
    useFeature: jest.fn(),
    useFeatureFlags: jest.fn(() => ({})),
  }),
  { virtual: true },
);

jest.mock("LLM/components/DeviceIntentExecutor", () => ({
  __esModule: true,
  DeviceIntentExecutorLWM: (props: unknown) => {
    mockDeviceIntentExecutorLWM(props);
    return null;
  },
}));

jest.mock("../hooks/useSignatureViewModel", () => ({
  useSignatureViewModel: jest.fn(),
}));

const mockBleDevice = {
  modelId: DeviceModelId.stax,
  wired: false,
  deviceId: "mock-ble-device",
};

function buildViewModel(
  overrides: Record<string, unknown> = {},
): ReturnType<typeof UseSignatureViewModelModule.useSignatureViewModel> {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    account: { id: "account-1" } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: { family: "bitcoin" } as any,
    device: mockBleDevice,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request: {} as any,
    deviceInitializationInput: {
      appName: "Bitcoin",
      dependencies: [],
      requireLatestFirmware: false,
      allowPartialDependencies: false,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signatureIntent: { uuid: "signature-intent" } as any,
    isSigningCompleted: false,
    onIntentJobStateChanged: jest.fn(),
    onIntentJobError: jest.fn(),
    onUserCancel: jest.fn(),
    ...overrides,
  } as ReturnType<typeof UseSignatureViewModelModule.useSignatureViewModel>;
}

describe("SignatureScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(UseSignatureViewModelModule.useSignatureViewModel)
      .mockReturnValue(buildViewModel());
  });

  describe("when required flow data is missing", () => {
    it("should render nothing when account is missing", () => {
      jest
        .mocked(UseSignatureViewModelModule.useSignatureViewModel)
        .mockReturnValue(buildViewModel({ account: null }));
      render(<SignatureScreen />);
      expect(screen.queryByTestId("send-signature-step")).toBeNull();
    });

    it("should render nothing when transaction is missing", () => {
      jest
        .mocked(UseSignatureViewModelModule.useSignatureViewModel)
        .mockReturnValue(buildViewModel({ transaction: null }));
      render(<SignatureScreen />);
      expect(screen.queryByTestId("send-signature-step")).toBeNull();
    });

    it("should render nothing when device is missing", () => {
      jest
        .mocked(UseSignatureViewModelModule.useSignatureViewModel)
        .mockReturnValue(buildViewModel({ device: null }));
      render(<SignatureScreen />);
      expect(screen.queryByTestId("send-signature-step")).toBeNull();
    });

    it("should render nothing when device initialization input is missing", () => {
      jest
        .mocked(UseSignatureViewModelModule.useSignatureViewModel)
        .mockReturnValue(buildViewModel({ deviceInitializationInput: null }));
      render(<SignatureScreen />);
      expect(screen.queryByTestId("send-signature-step")).toBeNull();
    });

    it("should render nothing when signature intent is missing", () => {
      jest
        .mocked(UseSignatureViewModelModule.useSignatureViewModel)
        .mockReturnValue(buildViewModel({ signatureIntent: null }));
      render(<SignatureScreen />);
      expect(screen.queryByTestId("send-signature-step")).toBeNull();
    });
  });

  it("should render DeviceIntentExecutorLWM with signature props", () => {
    const viewModel = buildViewModel();
    jest.mocked(UseSignatureViewModelModule.useSignatureViewModel).mockReturnValue(viewModel);

    render(<SignatureScreen />);

    expect(screen.getByTestId("send-signature-step")).toBeOnTheScreen();
    expect(mockDeviceIntentExecutorLWM).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        sourceFlow: "send",
        deviceConnectionParams: { acceptedDeviceModelIds: [] },
        deviceInitializationInput: viewModel.deviceInitializationInput,
        intent: viewModel.signatureIntent,
        intentComponentExtraProps: undefined,
        cancellableUI: true,
        onIntentJobStateChanged: viewModel.onIntentJobStateChanged,
        onIntentJobError: viewModel.onIntentJobError,
        onUserCancel: viewModel.onUserCancel,
      }),
    );
  });

  it("should make DeviceIntentExecutorLWM non-cancellable once signing is completed", () => {
    const viewModel = buildViewModel({ isSigningCompleted: true });
    jest.mocked(UseSignatureViewModelModule.useSignatureViewModel).mockReturnValue(viewModel);

    render(<SignatureScreen />);

    expect(mockDeviceIntentExecutorLWM).toHaveBeenCalledWith(
      expect.objectContaining({
        cancellableUI: false,
      }),
    );
  });
});
