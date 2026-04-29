import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { UserService } from "lib/http/user";

const KEY = "DeviceId";

interface Store {
  get: (key: string) => Promise<string | null>,
  set: (key: string, value: string) => Promise<void>
}

const localStore: Store = {
  get: async (key: string) => localStorage.getItem(key),
  set: async (key: string, value: string) => {
    localStorage.setItem(key, value);
  }
}

const secureStore: Store = {
  get: async (key: string) => await SecureStore.getItemAsync(key),
  set: async (key: string, value: string) => await SecureStore.setItemAsync(key, value)
};

const store = Platform.OS === "web" ? localStore : secureStore;


export async function hasDeviceId() {
  return (await getDeviceId()) !== null;
}

export async function getDeviceId() {
  return await store.get(KEY);
}

export async function setDeviceId(id: string) {
  return await store.set(KEY, id); 
}

export async function register() {
  const shouldRegister = !(await hasDeviceId());
  
  if (!shouldRegister) {
    return;
  }

  try {
    await UserService.registerDevice({});
  } catch (err) {
    console.error("Couldn't register device", {
      err: (err as any)?.message ?? err
    })
  }
}