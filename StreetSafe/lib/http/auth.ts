import * as z from "zod";

import { BACKEND_URL } from "utils/config";

const createExchangeContextResponseSchema = z.object({
  authorizeUrl: z.url().nonoptional(),
  exchangeContextId: z.string().nonoptional()
});

const exchangeResponseSchema = z.object({
  token: z.string().nonempty(),
  expiresAt: z.iso.datetime().nonoptional()
    .transform((arg, _) => new Date(arg))
});

export type ExchangeContext = z.infer<typeof createExchangeContextResponseSchema>;
export type ExchangeResponse = z.infer<typeof exchangeResponseSchema>;

type Provider = "google";

const createContext = async (provider: Provider): Promise<ExchangeContext> => {
  const result = await fetch(BACKEND_URL + "/oauth2/providers/google")
    .then((res) => res.json())
    .then((data) => createExchangeContextResponseSchema.parse(data))

  return result;
};

const exchange = async (token: string): Promise<ExchangeResponse> => {
  const result = await fetch(BACKEND_URL + "/oauth2/exchange", {
    method: "POST",
    body: JSON.stringify({ exchangeContextId: token }),
    headers: { "Content-Type": "application/json" }
  })  
    .then((res) => res.json())
    .then((data) => exchangeResponseSchema.parse(data));

  return result;
}

export const AuthService = {
  createContext,
  exchange
};