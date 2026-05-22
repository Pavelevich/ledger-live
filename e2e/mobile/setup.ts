import { device, log } from "detox";
import { launchApp, setupEnvironment } from "./helpers/commonHelpers";
import { sanitizeError } from "@ledgerhq/live-common/e2e/index";
import { close as closeBridge } from "./bridge/server";
import { getEnv, setEnv } from "@ledgerhq/live-env";
import { setAllureDescription } from "./helpers/allure/allure-helper";
import {
  endTestCapture,
  isPerTestCaptureEnabled,
  startTestCapture,
} from "./helpers/mitm-test";

const broadcastOriginalValue = getEnv("DISABLE_TRANSACTION_BROADCAST");
setupEnvironment();

beforeAll(
  async () => {
    const port = await launchApp();
    await device.reverseTcpPort(8081);
    await device.reverseTcpPort(port);
    await device.reverseTcpPort(52619); // To allow the android emulator to access the dummy app
    setAllureDescription();
  },
  process.env.CI ? 150000 : 120000,
);

afterAll(async () => {
  if (process.env.CI) {
    try {
      await app.portfolio.openViaDeeplink(5000);
      await device.terminateApp();
    } catch (e) {
      log.warn(`setup afterAll terminateApp failed: ${sanitizeError(e)}`);
    }
  }

  setEnv("DISABLE_TRANSACTION_BROADCAST", broadcastOriginalValue);
  closeBridge();
  try {
    await app.common.removeSpeculos();
  } catch (e) {
    log.warn(`setup afterAll removeSpeculos failed: ${sanitizeError(e)}`);
  }
});

// Per-test HAR capture (opt-in via MITM=1 + MITM_HAR_DIR). The addon
// running inside mitmproxy clears its flow buffer at `start` and writes
// the test's HAR file at `end`. Failures here are logged but never fail
// the spec — capture is a debugging aid, not test infrastructure.
if (isPerTestCaptureEnabled()) {
  beforeEach(async () => {
    const name = expect.getState().currentTestName ?? "unknown";
    await startTestCapture(name);
  });

  afterEach(async () => {
    const name = expect.getState().currentTestName ?? "unknown";
    await endTestCapture(name);
  });
}
