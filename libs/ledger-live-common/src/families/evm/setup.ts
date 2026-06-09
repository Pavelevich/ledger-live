// Goal of this file is to inject all necessary device/signer dependency to coin-modules

import makeCliTools from "@ledgerhq/coin-evm/cli-transaction";
import evmResolver from "@ledgerhq/coin-evm/hw-getAddress";
import { prepareMessageToSign, signMessage } from "@ledgerhq/coin-evm/hw-signMessage";
import { CreateSigner, createMessageSigner, createResolver } from "../../bridge/setup";
import { Resolver } from "../../hw/getAddress/types";
import Transport from "@ledgerhq/hw-transport";
import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { DmkSignerEth, LegacySignerEth } from "@ledgerhq/live-signer-evm";
import { EvmSigner } from "@ledgerhq/coin-evm/types/signer";

const createSigner: CreateSigner<EvmSigner> = (transport: Transport) => {
  if (isDmkTransport(transport)) {
    return new DmkSignerEth(transport.dmk, transport.sessionId, {
      calMode: isSpeculosTransport(transport) ? "test" : undefined,
    });
  }

  return new LegacySignerEth(transport);
};

const isDmkTransport = (
  transport: Transport,
): transport is Transport & { dmk: DeviceManagementKit; sessionId: string } => {
  return (
    "dmk" in transport &&
    transport.dmk !== undefined &&
    "sessionId" in transport &&
    transport.sessionId !== undefined
  );
};

// Speculos only trusts test-signed clear-signing data, so the CAL must be queried
// in "test" mode when signing against it (otherwise the device rejects the
// clear-signing context and demands blind signing). Detected via a duck-typed
// marker to avoid importing the Speculos transport into production bundles.
const isSpeculosTransport = (transport: Transport): boolean =>
  "isSpeculos" in transport && (transport as { isSpeculos?: boolean }).isSpeculos === true;

const messageSigner = {
  prepareMessageToSign,
  signMessage: createMessageSigner(createSigner, signMessage),
};

const resolver: Resolver = createResolver(createSigner, evmResolver);

const cliTools = makeCliTools();

export { cliTools, resolver, messageSigner };
