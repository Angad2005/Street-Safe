import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

import { Platform } from "react-native";
import { UserService } from "lib/http/user";

const EXPO_SUPPORTED_PLATFORMS = ["ios", "android"];
const NATIVE_IMPL_PLATFORMS = ["web"];

const SUPPORTED_PLATFORMS = [
  ...EXPO_SUPPORTED_PLATFORMS,
  ...NATIVE_IMPL_PLATFORMS
];

// @ts-expect-error 2339 This method exists on the web, and this function is only called in that context.
const fromBase64 = (data: string) => Uint8Array.fromBase64(
  data, 
  { alphabet: "base64url" }
);

// @ts-expect-error 2339 This method exists on the web, and this function is only called in that context.
const toBase64 = (data: ArrayBuffer) => (new Uint8Array(data)).toBase64();

export const tryRegisterForPushNotifications = async () => {
  if (!SUPPORTED_PLATFORMS.includes(Platform.OS)) {
    console.warn("[notifications] Can't register for push notifications on this platform", {
      current: Platform.OS,
      supported: SUPPORTED_PLATFORMS
    });

    return;
  }

  try {
    if (EXPO_SUPPORTED_PLATFORMS.includes(Platform.OS)) {
      await registerForPushNotifications();
    }

    if (NATIVE_IMPL_PLATFORMS.includes(Platform.OS)) {
      await registerServiceWorker();
    }
  } catch (err) {
    console.error("[notifications] Failed to register for push notifications", {
      err: (err as any)?.message ?? err
    });
  }
}

export const registerForPushNotifications = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      "StreetSafeNotifications",
      {
        name: "StreetSafe Notifications",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C'
      }
    );
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // They likely denied us. There isn't much more we can do here.
    if (finalStatus !== 'granted') {
      return;
    }

    // TODO: Does this emit tokens to `addPushTokenListener`?
    await Notifications.getDevicePushTokenAsync()
  };
}

export const handlePushTokenEvent = (token: Notifications.DevicePushToken) => {
  if (!SUPPORTED_PLATFORMS.includes(token.type)) {
    return;
  }

  console.log("[notifications] Received push token");

  UserService.registerDevice({
    pushToken: token.data
  });
}

export const registerServiceWorker = async () => {
  if (Platform.OS !== 'web') {
    return;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/notification.worker.js');  
    console.log("[notifications] Registered service worker");
  }

  if ('Notification' in window) {
    const permission = await window.Notification.requestPermission();

    if (permission !== "granted") {
      console.warn("[notification] Permission was not granted");
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      applicationServerKey: fromBase64("BJXb58o55cVWg9HPSYESQwSHG1PKijPKARoP1RlJWw5PGuXp36E0dnI9b3Yin-ccAs_v7AxwPUUgXifmToea44w"),
      userVisibleOnly: true
    });

    const payload = {
      endpoint: sub.endpoint,
      expiresAt: sub.expirationTime,
      keys: {
        p256dh: toBase64(sub.getKey("p256dh")!),
        auth: toBase64(sub.getKey("auth")!)
      }
    };

    await UserService.registerDevice({
      pushToken: payload
    })
  }
}