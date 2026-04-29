import * as z from "zod";
import google from "./google"

import type { Provider } from "./types.d";


export const providers = [google] as const;
export type ProviderKey = (typeof providers)[number]["id"];

// Collect from a `ServiceKey[]` to a mapping of `ServiceKey -> Service`.
const serviceMap = providers.reduce(
  (acc, service) => {
    acc[service.id] = service;
    return acc;
  }, 
  {} as Record<ProviderKey, Provider>
);

export const validProviders = providers.map((service) => service.id) as ProviderKey[];

// Lets us treat a parsed value through this as a `ServiceKey.`
export const validProviderKeySchema = z.enum(validProviders).transform<ProviderKey>(
  (arg, _) => arg as unknown as ProviderKey
);

export const getProvider = (key: ProviderKey): Provider => serviceMap[key];