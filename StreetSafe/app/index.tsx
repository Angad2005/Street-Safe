import React, { useEffect, useRef } from "react";
import { View, Image, Animated, Easing, StyleSheet, Platform, Text, ScrollView } from "react-native";
import { Href, router, Stack } from "expo-router";
import { useFonts, Rajdhani_400Regular, Rajdhani_600SemiBold, Rajdhani_700Bold } from "@expo-google-fonts/rajdhani";
import * as Haptics from 'expo-haptics';

import { useTheme } from "utils/useTheme";
import { MainButton } from "components/MainButton";
import { Root } from "components/Root";
import { fetchWithToken, isAuthed, useAuthState } from "lib/stores/auth";
import { ButtonText } from "components/ButtonText";
import { BACKEND_URL } from "utils/config";

export default function Home() {
  const theme = useTheme();

  const [fontsLoaded] = useFonts({
    Rajdhani_400Regular,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
  });

  const isSignedIn = isAuthed();
  const { clearCredentials } = useAuthState();
  
  // On first page load, check if user is signed in
  useEffect(() => {
    if (!isAuthed()) return;
    (async () => {

      const check = await fetchWithToken(`${BACKEND_URL}/api/checkAuth`);

      if (!check.ok) {
        clearCredentials();
      }

    })();
  }, []);

  const navItems = isSignedIn ? [
    { label: "📍   Live Tracking", route: "/tracking" },
    { label: "🚨   Hazard Reporting", route: "/hazardReporting" },
    { label: "🗺   Navigating", route: "/navigating" },
    { label: "⚙️   Settings", route: "/settings" },
    { label: "📝   Friends", route: "/friends" },
  ] :
  [{ label: "Login", route: "/auth/login" }];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideValues = useRef(navItems.map(() => new Animated.Value(20))).current;

  useEffect(() => {
    if (!fontsLoaded) return;

    const fadeIn = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    });

    const slideAnims = navItems.map((_, i) =>
      Animated.timing(slideValues[i], {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    Animated.parallel([
      fadeIn,
      Animated.stagger(120, slideAnims)
    ]).start();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <Root>
        <Stack.Screen options={{ headerShown: false }} />

        <Animated.View style={[s.logoSection, { opacity: fadeAnim }]}>
          <Image
            source={require("../assets/generated-image-1.png")}
            style={s.logoImg}
          />
          <Text style={s.title}>StreetSafe</Text>
        </Animated.View>

        <Animated.View style={[s.divider, { opacity: fadeAnim }]} />

        <View style={s.buttons}>
          {navItems.map((item, i) => (
            <Animated.View
              key={item.route}
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideValues[i] }],
                width: "100%",
              }}
            >
              <MainButton
                style={{ width: "100%" }}
                onPress={async () => { 
                  if (Platform.OS !== "web") {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
                  }
                  router.push(item.route as Href);
                }}
              >
                <ButtonText>{item.label}</ButtonText>
              </MainButton>
            </Animated.View>
          ))}
        </View>

      </Root>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  logoSection: {
    alignItems: "center",
    marginBottom: 16,
  },
  logoImg: {
    width: 110,
    height: 110,
    resizeMode: "contain",
  },
  title: {
    marginTop: 10,
    fontSize: 30,
    fontFamily: "Rajdhani_700Bold",
    color: "#fff",
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  divider: {
    width: "40%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 36,
  },
  buttons: {
    width: "100%",
    gap: 14,
    alignItems: "center",
    paddingHorizontal: 28,
  }
});