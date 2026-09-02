import { BaseText } from "components/Base/BaseText";
import { MainButton } from "components/MainButton";
import { Root } from "components/Root";

import { useCallback, useEffect, useRef } from "react";
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  Platform, 
  Text 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from 'expo-haptics';

import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Redirect, type Route, router, useLocalSearchParams } from "expo-router";

import { AuthService, ExchangeContext } from "lib/http/auth";
import { useAuthState } from "lib/stores/auth";
import { tryUpdateUser } from "lib/stores/user";
import { useDarkMode } from "utils/global";

const isAllowedRedirect = (url: string) => url.startsWith("/") && !url.startsWith("//");
const sanitizeRedirect = (url?: string): Route => {
  if (!url || !isAllowedRedirect(url)) {
    return "/";
  }
  return url as Route;
};

const handleExternalLogin = async (
  context?: ExchangeContext,
  redirectTo?: string
) => {
  try {
    if (!context) {
      context = await AuthService.createContext("google");
    }

    const redirectUrl = Linking.createURL("/auth/complete");
    const result = await WebBrowser.openAuthSessionAsync(
      context.authorizeUrl,
      redirectUrl
    );

    if (["success", "dismiss"].includes(result.type)) {
      const exchangeResult = await AuthService.exchange(context.exchangeContextId);
      if (exchangeResult?.token) {
        useAuthState.getState().setCredentials({
          token: exchangeResult.token,
          expiresAt: new Date(exchangeResult.expiresAt).getTime()
        });

        await tryUpdateUser();
        router.push(sanitizeRedirect(redirectTo));
      }
    }
  } catch (error) {
    console.warn("[Login] Auth session encountered an error:", error);
  }
};

export default function Login() {
  const isDark = useDarkMode((s) => s.isDarkMode);
  const signedIn = useAuthState((state) => state.kind === "SignedIn");
  const params = useLocalSearchParams<{ redirectTo?: string }>();

  const contextRef = useRef<ExchangeContext | undefined>(undefined);

  useEffect(() => { 
    if (signedIn) return;

    AuthService.createContext("google")
      .then((res) => {
        contextRef.current = res;
      })
      .catch((err) => {
        console.warn("[Login] Failed to create auth context:", err);
      });
  }, [signedIn]);

  const handlePress = useCallback(() => {
    handleExternalLogin(contextRef.current, params.redirectTo);
  }, [params.redirectTo]);

  const handleGoBack = async () => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/");
  };

  if (signedIn) {
    return <Redirect href={sanitizeRedirect(params.redirectTo)} />;
  }

  return (
    <View style={s.mainWrapper}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* FIXED NAV BAR */}
      <SafeAreaView style={s.navBar}>
        <View style={s.navContent}>
          <TouchableOpacity style={s.backButton} onPress={handleGoBack} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color="#2C3E50" />
          </TouchableOpacity>
          <Text style={s.navTitle}>Login</Text>
          <View style={{ width: 40 }} /> 
        </View>
      </SafeAreaView>

      <Root>
        <View style={s.contentContainer}>
          <BaseText style={s.welcomeText}>
            Welcome Back
          </BaseText>
          
          <MainButton onPress={handlePress} style={s.loginButton}>
            <Ionicons name="logo-google" size={20} color="white" style={{ marginRight: 10 }} />
            <BaseText>Login with Google</BaseText>
          </MainButton>
        </View>
      </Root>
    </View>
  );
}

const s = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF', 
  },
  navBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F2F5', 
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700', 
    color: '#1A1A1A',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
  },
  loginButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 55,
    borderRadius: 12,
  }
});
