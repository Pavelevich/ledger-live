import {
  WalletAuthHttpError,
  WalletAuthInvalidAuthorizationError,
  WalletAuthInvalidTokenError,
} from "../../src/errors";
import { postForm, postJson } from "../../src/http";
import type { IdentityProvider, IdPAuthParams, KeycloakToken } from "../../src/types";

export class LkrpIdentityProvider implements IdentityProvider<LKRPChallenge> {
  readonly brokerId = "lkrp";

  constructor(
    private readonly signer: Signer,
    private readonly memberCredentials: MemberCredentials,
  ) {}

  async authenticate(request: IdPAuthParams<LKRPChallenge>): Promise<KeycloakToken> {
    const host = request.challenge.json.host;
    console.log("[LKRP] IdP host:", host);
    console.log("[LKRP] challenge.json:", request.challenge.json);
    console.log("[LKRP] challenge.tlv:", request.challenge.tlv);
    console.log("[LKRP] redirectUri:", request.redirectUri);

    // Step 1: prove ownership of the key by sending the signed challenge, getting back an authorization code.
    const signature = this.signChallenge(request.challenge);
    console.log("[LKRP] step1 signed challenge:", signature);
    const authorizationCode = await postJson<string>(`https://${host}/openid/v1/authenticate`, {
      challenge: request.challenge.json,
      signature,
    }).catch(e => {
      console.error("[LKRP] step1 (authenticate) failed:", describeError(e));
      throw e;
    });
    console.log("[LKRP] step1 authorization code:", authorizationCode);
    if (!authorizationCode) {
      throw new WalletAuthInvalidAuthorizationError();
    }

    const formBody = new URLSearchParams({
      grant_type: "authorization_code",
      code: authorizationCode,
      client_id: request.clientId,
      redirect_uri: request.redirectUri,
    });
    if (request.codeVerifier) {
      formBody.set("code_verifier", request.codeVerifier);
    }

    // Step 2: redeem the authorization code (with PKCE verifier when present) for the IdP access token.
    const idPToken = await postForm<AccessTokenResponse>(
      `https://${host}/openid/v1/token`,
      formBody,
    ).catch(e => {
      console.error("[LKRP] step2 (token) failed:", describeError(e));
      throw e;
    });
    console.log("[LKRP] step2 token response:", idPToken);
    if (!idPToken.access_token) {
      throw new WalletAuthInvalidTokenError();
    }

    // Step 3: exchange the IdP token for the Keycloak token directly at the IdP, authenticating with the IdP token.
    const exchangeBody: ExchangeRequest = { client_id: request.clientId };
    const exchangeResponse = await postJson<AccessTokenResponse>(
      `https://${host}/openid/v1/exchange`,
      exchangeBody,
      { Authorization: `Bearer ${idPToken.access_token}` },
    ).catch(e => {
      console.error("[LKRP] step3 (exchange) failed:", describeError(e));
      throw e;
    });
    console.log("[LKRP] step3 exchange response:", exchangeResponse);

    return {
      scope: exchangeResponse.scope,
      tokenType: exchangeResponse.token_type,
      accessToken: exchangeResponse.access_token,
      expiresIn: exchangeResponse.expires_in,
      refreshToken: exchangeResponse.refresh_token,
      refreshExpiresIn: exchangeResponse.refresh_expires_in,
    };
  }

  private signChallenge(challenge: LKRPChallenge): ChallengeSignature {
    const unsignedChallengeTLV = this.getUnsignedChallengeTLV(challenge.tlv);
    return {
      credential: this.credential(),
      attestation: this.getAttestation(),
      signature: this.signer.sign(this.memberCredentials.privatekey, unsignedChallengeTLV),
    };
  }

  private getUnsignedChallengeTLV(tlv: string): string {
    // The unsigned challenge is the original TLV with the signature and attestation fields removed.
    const tlvBytes = Buffer.from(tlv, "hex");
    // Tags to strip to rebuild the canonical "unsigned challenge" the relying party (rp) signed:
    // 0x14 (rp signAlgorithm), 0x15 (rp signature), 0x32 (rp curveId), 0x33 (rp publicKey).
    // The challenge data (0x12), expiry (0x16), host (0x20) and protocol version (0x60) are kept.
    const TO_EXCLUDE = new Set([0x14, 0x15, 0x32, 0x33]);
    const fields: Buffer[] = [];
    for (let i = 0; i < tlvBytes.length; ) {
      const tag = tlvBytes[i];
      const length = tlvBytes[i + 1];
      if (!TO_EXCLUDE.has(tag)) {
        fields.push(tlvBytes.subarray(i, i + 2 + length));
      }
      i += 2 + length; // move to the next TLV entry
    }
    return Buffer.concat(fields).toString("hex");
  }

  private credential(): ChallengeSignature["credential"] {
    // curveId 33 = secp256k1, signAlgorithm 1 = ECDSA (matches the challenge's rp credential).
    return { version: 0, curveId: 33, signAlgorithm: 1, publicKey: this.memberCredentials.pubkey };
  }

  // Spec https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4335960138/ARCH+LedgerLive+Auth+specifications
  private getAttestation(): string {
    const bytes = new TextEncoder().encode(this.memberCredentials.trustchainId);
    return Buffer.from([0x02, bytes.length, ...bytes]).toString("hex");
  }
}

function describeError(e: unknown): string {
  if (e instanceof WalletAuthHttpError) {
    return `WalletAuthHttpError status=${e.status} message=${e.message}`;
  }
  if (e instanceof Error) {
    return `${e.name}: ${e.message}`;
  }
  return String(e);
}

// --- Types ---

export type MemberCredentials = {
  trustchainId: string;
  pubkey: string;
  privatekey: string;
};

export type LKRPChallenge = { json: ChallengeJSON; tlv: string };

type ChallengeJSON = {
  version: number;
  challenge: { data: string; expiry: string };
  host: string;
  rp: Array<{
    credential: { version: number; curveId: number; signAlgorithm: number; publicKey: string };
    signature: string;
  }>;
  protocolVersion: { major: number; minor: number; patch: number };
};

export type Signer = {
  sign(privateKey: string, message: string): string;
};

type ChallengeSignature = {
  credential: { version: 0; curveId: 33; signAlgorithm: 1; publicKey: string };
  signature: string;
  attestation: string;
};

type AccessTokenResponse = {
  scope: string;
  token_type: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
};

type ExchangeRequest = {
  client_id: string;
};
