import { Stack } from "expo-router";
import { tryUpdateUser } from "lib/stores/user";
import { useEffect } from "react";

import * as Notifications from "expo-notifications";

import { useFonts } from "expo-font";
import { handlePushTokenEvent, tryRegisterForPushNotifications } from "lib/notifications";
import { isAuthed } from "lib/stores/auth";


export default function Layout() {
  const authed = isAuthed();
  useEffect(() => {
    tryUpdateUser();
  }, [authed]);

  useEffect(() => {
    const subscription = Notifications.addPushTokenListener(handlePushTokenEvent);

    
    (async () => {
      await tryRegisterForPushNotifications();
    })();

    return () => subscription.remove();
  }, []);

  const [fontsLoaded] = useFonts({
    OpenDyslexic: require("../assets/fonts/OpenDyslexic-Regular.otf"),
  });

  if (!fontsLoaded) return null;

  return <Stack 
    screenOptions={{
      headerShown: false
    }}
  />;
}