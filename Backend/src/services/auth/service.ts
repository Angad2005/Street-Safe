import { URLSearchParams } from "node:url";

import { generateSignedRandomBytes } from "~/lib/crypto/random";
import { OAUTH_BASE_URL } from "~/lib/config";

import * as context from "./context";
import { getProvider, ProviderKey } from "./providers";
import type { Provider } from "./providers/types";


interface AuthorizeUrlResult {
  url: string;
  state: Buffer;
}


const buildCallbackUrl = (provider: Provider) => `${OAUTH_BASE_URL}/oauth2/providers/${provider.id}/callback`;

const buildAuthorizeUrl = (
  provider: Provider
): AuthorizeUrlResult => {
  // const entropy = generateRandomBytes(32);
  // const payload = `${provider.id}.${
  //   base64.encodeWithoutPadding(entropy)
  // }`;

  const state = generateSignedRandomBytes(32);

  // const signed = sign(Buffer.from(payload, "utf-8"));

  const urlParams = new URLSearchParams();
  urlParams.append("client_id", provider.clientId);
  
  if (provider.accessType) {
    urlParams.append("access_type", provider.accessType);
  }

  urlParams.append("response_type", "code");
  urlParams.append("scope", provider.scopes.join(" "));
  urlParams.append("redirect_uri", buildCallbackUrl(provider));
  urlParams.append("state", state.signed)
  
  const url = `${provider.urls.authorize}?${urlParams.toString()}`;

  return { url, state: state.raw };
}

const exchange = async (provider: Provider, code: string): Promise<unknown> => {
  const params = new URLSearchParams();
  params.set("code", code);
  params.set("client_id", provider.clientId);
  params.set("client_secret", provider.clientSecret);
  params.set("redirect_uri", buildCallbackUrl(provider));
  params.set("grant_type", "authorization_code");

  const result = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = await result.json();
  return data as unknown;
}

const createContext = (providerKey: ProviderKey) => {
  const provider = getProvider(providerKey);
  const { url, state } = buildAuthorizeUrl(provider);

  const exchangeContextId = context.create(state);

  return {
    exchangeContextId,
    authorizeUrl: url
  };
};

const trackExchange = (state: Buffer, userId: number) => context.updateTokenUsingState(state, userId)
const getAccountIdFromExchangeContext = context.getExchangedAccountIdForToken;
const invalidateExchangeToken = context.markUsed;

export const authService = {
  buildCallbackUrl,
  buildAuthorizeUrl,
  exchange,
  createContext,
  trackExchange,
  getAccountIdFromExchangeContext,
  invalidateExchangeToken
}