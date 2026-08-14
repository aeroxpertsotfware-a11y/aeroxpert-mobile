import React, { useEffect, useState, useCallback } from "react";
import { View, ActivityIndicator, Text, Alert, Linking } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from "@expo-google-fonts/nunito";

import LoginScreen from "./src/screens/LoginScreen";
import PilotsScreen from "./src/screens/PilotsScreen";
import QrScanScreen from "./src/screens/QrScanScreen";
import BateriaDetalleScreen from "./src/screens/BateriaDetalleScreen";
import ScreenBroadcastScreen from "./src/screens/ScreenBroadcastScreen";
import { registerPushToken } from "./src/services/push";

const TOKEN_KEY = "@auth_token";

type RootStackParamList = {
  Login: undefined;
  Pilots: undefined;
  QrScan: undefined;
  BateriaDetalle: { bateria: any };
  ScreenBroadcast: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppInner() {
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (mounted) setToken(null);
      } catch {
        if (mounted) setToken(null);
      } finally {
        if (mounted) setBooting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const openBroadcastLink = (response: Notifications.NotificationResponse | null) => {
      const url = String(response?.notification?.request?.content?.data?.viewerUrl || "").trim();
      if (/^https:\/\//i.test(url)) Linking.openURL(url).catch(() => {});
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(openBroadcastLink);
    Notifications.getLastNotificationResponseAsync().then(openBroadcastLink).catch(() => {});
    return () => subscription.remove();
  }, []);

  const handleLoginSuccess = useCallback(async (newToken: string) => {
    try {
      const t = (newToken || "").trim();
      if (!t) {
        Alert.alert("Login", "Token inválido. Intenta nuevamente.");
        return;
      }

      await AsyncStorage.setItem(TOKEN_KEY, t);
      setToken(t);

      registerPushToken(t).catch((e) =>
        console.log("No se pudo registrar push token:", e?.message || e)
      );
    } catch {
      Alert.alert("Error", "No se pudo guardar la sesión. Intenta nuevamente.");
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } finally {
      setToken(null);
    }
  }, []);

  if (!fontsLoaded || booting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Iniciando...</Text>
      </View>
    );
  }

  return (
    <>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!token ? (
            <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />
              )}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="Pilots">
                {(props) => (
                  <PilotsScreen {...props} token={token} onLogout={handleLogout} />
                )}
              </Stack.Screen>
              <Stack.Screen name="QrScan" component={QrScanScreen} />
              <Stack.Screen name="BateriaDetalle" component={BateriaDetalleScreen} />
              <Stack.Screen name="ScreenBroadcast">
                {(props) => <ScreenBroadcastScreen {...props} token={token} />}
              </Stack.Screen>
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>

      <Toast />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}
