import { clearCredentials, fetchWithToken, getToken, isAuthed, useAuthState } from "lib/stores/auth";
import { BACKEND_URL } from "utils/config";
import * as z from "zod";

import { Platform } from "react-native";
import { getDeviceId, setDeviceId } from "lib/device";

const userSchema = z.object({
  id: z.number().nonoptional(),
  name: z.string().nonoptional(),
  email: z.email().nonoptional(),
  avatarUrl: z.url().nonoptional(),
});

const registerPushNotificationTokenResponseSchema = z.object({
  deviceId: z.string().optional()
});

export type UserResponse = z.infer<typeof userSchema>;
export type RegisterPushNotificationTokenResponse = z.infer<typeof registerPushNotificationTokenResponseSchema>;

const getCurrent = async (): Promise<UserResponse | null> => {  
  if (!isAuthed()) {
    console.log("Not authed");
    return null;
  }

  const check = await fetchWithToken(`${BACKEND_URL}/api/checkAuth`);
  
  if (!check.ok) {
      clearCredentials();
      return null;
  }

  return await fetch(BACKEND_URL + "/users/@me", {
    headers: { "Authorization": `Bearer ${getToken()}` },
  })
    .then((res) => res.json())
    .then((data) => userSchema.parse(data));
};


interface RegisterDeviceParams {
  pushToken?: string | {
    endpoint: string;
    expiresAt: number | null;
    keys: {
      p256dh: string;
      auth: string;
    }
  };
}

const registerDevice = async (params: RegisterDeviceParams): Promise<RegisterPushNotificationTokenResponse | null> => {
  if (!isAuthed()) {
    return null;
  }

  const deviceId = await getDeviceId()

  const key = Platform.OS === "web"
    ? "webPush"
    : "notificationPushToken"

  const result = await fetchWithToken(BACKEND_URL + "/users/@me/devices", {
    method: "PATCH",
    body: JSON.stringify({ 
      channel: Platform.OS,
      [key]: params.pushToken ?? null,
      deviceId: deviceId
    }),
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (result.status === 204) {
    return null;
  }

  const body = await result.json();
  const data = registerPushNotificationTokenResponseSchema.parse(body);

  if (data.deviceId) {
    setDeviceId(data.deviceId);
  }

  return data;
}
    
export const UserService = { getCurrent, registerDevice };
