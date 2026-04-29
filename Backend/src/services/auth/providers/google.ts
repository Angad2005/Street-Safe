import z from "zod";

import type { HandleCallbackResult, Provider, Identity } from "./types.d";
import { authService } from "../service";

import { OAUTH_GOOGLE_CLIENT_ID, OAUTH_GOOGLE_CLIENT_SECRET } from "~/lib/config";
import { currentUnixSeconds } from "~/lib/time";

export const exchangeResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().nonnegative(),
  refresh_token: z.string().optional(),
  refresh_token_expires_in: z.number().nonnegative().optional(),
  scope: z.string(),
  token_type: z.string(),
  id_token: z.string()
});

export const profileSchema = z.object({
  sub: z.string().nonempty(),
  name: z.string().nonempty(),
  picture: z.url().nonempty(),
  email: z.string().nonempty(),
  email_verified: z.boolean()
});

const handleCallback = async (code: string): Promise<HandleCallbackResult> => {
  const data = await authService.exchange(google, code);
  const result = exchangeResponseSchema.parse(data);

  const identity = await getUserDetails(result.access_token);

  const accessTokenExpiresAt = new Date((currentUnixSeconds() + result.expires_in) * 1000);

  const refreshTokenExpiresAt = !!result.refresh_token_expires_in 
    ? new Date((currentUnixSeconds() + result.refresh_token_expires_in!) * 1000)
    : undefined;

  return {
    identity,
    tokens: {
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      accessTokenExpiresAt,
      refreshTokenExpiresAt
    },
  };
}

export const getUserDetails = async (token: string): Promise<Identity> => {
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      authorization: `Bearer ${token}`
    },
    method: "GET"
  })
    .then((res) => res.json());

  const data = profileSchema.parse(profileResponse);

  return {
    avatarUrl: data.picture,
    email: data.email,
    name: data.name,
    subject: data.sub
  };
}

const google = {
  id: "google",
  scopes: [
    "openid",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email"
  ],
  accessType: "offline",
  clientId: OAUTH_GOOGLE_CLIENT_ID!,
  clientSecret: OAUTH_GOOGLE_CLIENT_SECRET!,
  urls: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token"
  },
  handleCallback
} as const satisfies Provider;

export default google;