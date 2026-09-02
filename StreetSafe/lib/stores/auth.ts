import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

import { createJSONStorage, persist, StateStorage } from "zustand/middleware"
import { Platform } from "react-native";

const secureStore: StateStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync
};

// TODO: Really `Authorization` should be stored in cookies
// on the web, but that is an issue for another time.
const localStore: StateStorage = {
  getItem: async (name: string) => localStorage.getItem(name),
  setItem: async (name: string, value: string) => localStorage.setItem(name, value),
  removeItem: async (name: string) => localStorage.removeItem(name)
};

const store = Platform.OS === "web" ? localStore : secureStore;

interface Credentials {
  token: string;
  expiresAt: number;
}

export namespace AuthState {
  export type SignedIn = Credentials;

  export type Type = ({
    kind: 'SignedIn';
    data: SignedIn;
  } | {
    kind: 'NotSignedIn';
  }) & {
    setCredentials: (credentials: Credentials) => void;
    clearCredentials: () => void;
    isSignedIn: () => boolean;
  }
}

export const useAuthState = create<AuthState.Type>()(
  persist(
    (set, get) => ({
      kind: "NotSignedIn",
      setCredentials: (credentials: Credentials) => set({
        kind: "SignedIn",
        data: credentials
      }),
      clearCredentials: () => set({ kind: "NotSignedIn" }),
      isSignedIn: () => get().kind === "SignedIn"
    }),
    {
      name: "AuthenticationState",
      storage: createJSONStorage(() => store)
    }
  )
);

export const isAuthed = () => useAuthState.getState().isSignedIn();
export const clearCredentials = () => useAuthState.getState().clearCredentials();

export const getToken = () => {
  if (!isAuthed()) {
    // Just in case.
    useAuthState.getState().clearCredentials();
    throw new Error("Cannot get a token while not authed");
  }
  
  const { data } = (useAuthState.getState() as { data: AuthState.SignedIn })
  return data.token;
}

export const fetchWithToken = async (url: string, options: RequestInit = {}) => {
  if (!isAuthed()) {
    clearCredentials();
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  let token = "";
  try {
    token = getToken();
  } catch {
    clearCredentials();
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }
  const response = await fetch(url, {
    ...options,
    headers: { ...options.headers, "Authorization": `Bearer ${token}` },
  });
  if (response.status === 401) {
    clearCredentials();
  }
  return response;
};

