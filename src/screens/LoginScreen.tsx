// src/screens/LoginScreen.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { API_URL } from "../config/api";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Application from "expo-application";
import * as ImagePicker from "expo-image-picker";
import { registerPushToken } from "../services/push";
import { LinearGradient } from "expo-linear-gradient";
import { isOnline } from "../offline/net";

type Props = {
  onLoginSuccess: (token: string) => void;
};

type AccessOption = {
  empresaId?: string;
  rol?: string;
};

type ForgotPasswordStep = 1 | 2 | 3;

const FONT = {
  regular: "Nunito_400Regular",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extrabold: "Nunito_800ExtraBold",
  black: "Nunito_900Black",
} as const;

const MIN_LOADING_MS_PASSWORD = 4000; // ✅ con contraseña: mínimo 4s
const MIN_LOADING_MS_BIO = 2000; // ✅ biometría: mínimo 2s (después de huella/face)
const SECURE_PROFILE_KEY = "uas_profile_v1";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(
      () => reject(new Error("Timeout: el servidor no respondió")),
      ms
    );
    promise
      .then((res) => {
        clearTimeout(id);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(id);
        reject(err);
      });
  });
}

function joinUrl(base: string, path: string) {
  const b = (base || "").replace(/\/+$/, "");
  const p = (path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

  function apiPath(p: string) {
  const base = (API_URL || "").replace(/\/+$/, "");
  const normalizedP = p.replace(/^\/+/, "");
  if (base.endsWith("/api")) {
    return joinUrl(base, normalizedP.replace(/^api\/?/, ""));
  }
  return joinUrl(
    base,
    normalizedP.startsWith("api/") ? normalizedP : `api/${normalizedP}`
  );
}

function pickMobileAccess(accesses: AccessOption[] = []): AccessOption | null {
  const orderedRoles = ["piloto", "jefepilotos", "instructor", "admin", "estudiante"];
  for (const role of orderedRoles) {
    const found = accesses.find((item) => String(item?.rol || "").trim().toLowerCase() === role);
    if (found?.empresaId && found?.rol) return found;
  }
  return accesses.find((item) => item?.empresaId && item?.rol) || null;
}

const SECURE_TOKEN_KEY = "uas_token_v1";
const SECURE_DOC_KEY = "uas_doc_v1";
const ENABLE_FACE_VERIFY = false;

  export default function LoginScreen({ onLoginSuccess }: Props) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Vista tipo “Welcome + Login” como la referencia

  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [focusUser, setFocusUser] = useState(false);
  const [focusPass, setFocusPass] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotStep, setForgotStep] = useState<ForgotPasswordStep>(1);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPin, setForgotPin] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");

  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioTypeLabel, setBioTypeLabel] = useState<
    "Face ID" | "Touch ID" | "Biometría"
  >("Biometría");
    const [hasSavedToken, setHasSavedToken] = useState(false);

  const isExpoGo =
    Application.applicationId === "host.exp.exponent" ||
    Application.applicationId === "host.exp.exponent.dev";

  const showBiometrics = !(Platform.OS === "ios" && isExpoGo);

  const canSubmit = useMemo(
    () => !!usuario.trim() && !!password.trim() && !loading,
    [usuario, password, loading]
  );

  const canBio = useMemo(
    () => showBiometrics && bioAvailable && hasSavedToken && !loading,
    [showBiometrics, bioAvailable, hasSavedToken, loading]
  );

    useEffect(() => {
    (async () => {
      try {
        if (!showBiometrics) {
          setBioAvailable(false);
          setHasSavedToken(false);

          const savedDoc = await SecureStore.getItemAsync(SECURE_DOC_KEY);
          if (savedDoc) setUsuario(savedDoc);
          return;
        }

        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const types =
          await LocalAuthentication.supportedAuthenticationTypesAsync();

        const available = compatible && enrolled;
        setBioAvailable(available);

        if (
          types?.includes(
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
          )
        ) {
          setBioTypeLabel("Face ID");
        } else if (
          types?.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ) {
          setBioTypeLabel("Touch ID");
        } else {
          setBioTypeLabel("Biometría");
        }

        const token = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
        setHasSavedToken(!!token);

        const savedDoc = await SecureStore.getItemAsync(SECURE_DOC_KEY);
        if (savedDoc) setUsuario(savedDoc);
      } catch {
        setBioAvailable(false);
        setHasSavedToken(false);
      }
    })();
    }, [showBiometrics]);

    function resetForgotPasswordState(nextVisible = false) {
      setForgotVisible(nextVisible);
      setForgotStep(1);
      setForgotLoading(false);
      setForgotEmail("");
      setForgotPin("");
      setForgotPassword("");
      setForgotConfirmPassword("");
    }

    function openForgotPassword() {
      setForgotEmail("");
      setForgotPin("");
      setForgotPassword("");
      setForgotConfirmPassword("");
      setForgotStep(1);
      setForgotVisible(true);
    }

    async function forgotPasswordRequest(path: string, body: Record<string, string>) {
      const response = await withTimeout(
        fetch(apiPath(path), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        15000
      );

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }

      if (!response.ok) {
        throw new Error(data?.msg || data?.message || "No se pudo completar la solicitud.");
      }

      return data;
    }

    async function handleForgotRequestPin() {
      const email = forgotEmail.trim().toLowerCase();
      if (!email) {
        Alert.alert("Recuperación", "Ingresa tu correo electrónico.");
        return;
      }

      setForgotLoading(true);
      try {
        const data = await forgotPasswordRequest("password/request-pin", { email });
        setForgotEmail(email);
        setForgotPin("");
        setForgotStep(2);
        Alert.alert("Listo", data?.msg || "Revisa tu correo para ver el PIN.");
      } catch (e: any) {
        Alert.alert("Error", e?.message || "No se pudo enviar el PIN.");
      } finally {
        setForgotLoading(false);
      }
    }

    async function handleForgotVerifyPin() {
      const email = forgotEmail.trim().toLowerCase();
      const pin = forgotPin.trim();
      if (!email || !pin) {
        Alert.alert("Recuperación", "Ingresa el PIN enviado a tu correo.");
        return;
      }

      setForgotLoading(true);
      try {
        const data = await forgotPasswordRequest("password/verify-pin", { email, pin });
        setForgotStep(3);
        Alert.alert("Perfecto", data?.msg || "PIN verificado.");
      } catch (e: any) {
        Alert.alert("Error", e?.message || "PIN inválido.");
      } finally {
        setForgotLoading(false);
      }
    }

    async function handleForgotResetPassword() {
      const email = forgotEmail.trim().toLowerCase();
      const pin = forgotPin.trim();
      const newPassword = forgotPassword.trim();
      const confirmPassword = forgotConfirmPassword.trim();

      if (!newPassword || !confirmPassword) {
        Alert.alert("Recuperación", "Ingresa y confirma la nueva contraseña.");
        return;
      }
      if (newPassword !== confirmPassword) {
        Alert.alert("Recuperación", "Las contraseñas no coinciden.");
        return;
      }
      if (newPassword.length < 6) {
        Alert.alert("Recuperación", "La contraseña debe tener mínimo 6 caracteres.");
        return;
      }

      setForgotLoading(true);
      try {
        const data = await forgotPasswordRequest("password/reset-password", {
          email,
          pin,
          newPassword,
        });
        Alert.alert("Listo", data?.msg || "Contraseña actualizada.", [
          {
            text: "OK",
            onPress: () => {
              resetForgotPasswordState(false);
              setPassword("");
            },
          },
        ]);
      } catch (e: any) {
        Alert.alert("Error", e?.message || "No se pudo cambiar la contraseña.");
      } finally {
        setForgotLoading(false);
      }
    }

    async function captureFacePhoto() {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Cámara", "Necesitamos permiso de cámara para verificar tu rostro.");
        return null;
      }

      const res = await ImagePicker.launchCameraAsync({
        cameraType: ImagePicker.CameraType.front,
        quality: 0.4,
        allowsEditing: false,
        base64: false,
      });

      if (res.canceled) return null;
      return res.assets?.[0] || null;
    }

    async function verifyFaceWithBackend(token: string, documento: string) {
      const asset = await captureFacePhoto();
      if (!asset?.uri) return false;

      const body = new FormData();
      body.append("documento", documento);
      body.append(
        "image",
        {
          uri: asset.uri,
          name: "face.jpg",
          type: asset.mimeType || "image/jpeg",
        } as any
      );

      const url = apiPath("auth/verify-face");
      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body,
        }),
        20000
      );

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }

      if (!res.ok) {
        const detail = data?.message || data?.msg || data?.raw || raw || "No se pudo verificar el rostro.";
        Alert.alert("Verificación facial", detail);
        return false;
      }

      if (data?.enrolled) {
        Alert.alert("Verificación facial", "Rostro registrado correctamente.");
        return true;
      }

      if (data?.verified) return true;

      Alert.alert("Verificación facial", "El rostro no coincide. Intenta de nuevo.");
      return false;
    }

  async function handleLogin() {
    if (!usuario.trim() || !password.trim()) {
      Alert.alert("Validación", "Ingresa cédula y contraseña.");
      return;
    }

      // 🔴 Verificar conexión antes de llamar al backend
  const online = await isOnline();

  if (!online) {
    const savedToken = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);

    if (!savedToken) {
      Alert.alert(
        "Sin internet",
        "No puedes iniciar sesión por primera vez sin conexión. Conéctate a internet."
      );
      return;
    }

    // 🔐 Si hay biometría disponible, pedirla
    if (showBiometrics && bioAvailable) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Ingresar sin internet con ${bioTypeLabel}`,
        cancelLabel: "Cancelar",
        disableDeviceFallback: false,
        requireConfirmation: false,
      });

      if (!result.success) return;
    }

    Alert.alert(
      "Modo offline",
      "Ingresaste sin internet. Se sincronizará cuando vuelva la conexión."
    );

    onLoginSuccess(savedToken);
    return;
  }


  

    const start = Date.now();
    try {
      setLoading(true);

      const url = apiPath("auth/login");

      const res = await withTimeout(
        fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documento: usuario.trim(),
            password: password.trim(),
          }),
        }),
        12000
      );

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }

      if (!res.ok) {
        const msg =
          data?.message || data?.msg || data?.raw || `Error HTTP ${res.status}`;

        const elapsed = Date.now() - start;
        if (elapsed < MIN_LOADING_MS_PASSWORD) {
          await sleep(MIN_LOADING_MS_PASSWORD - elapsed);
        }

        Alert.alert("Login", msg);
        return;
      }

      let token = data?.token;
      if (!token) {
        const elapsed = Date.now() - start;
        if (elapsed < MIN_LOADING_MS_PASSWORD) {
          await sleep(MIN_LOADING_MS_PASSWORD - elapsed);
        }

        Alert.alert("Login", "El servidor respondió pero NO devolvió token.", [
          {
            text: "Ver respuesta",
            onPress: () =>
              Alert.alert("Respuesta", raw.slice(0, 1200) || "(vacía)"),
          },
        ]);
        return;
      }

      const documento = usuario.trim();

      const requiresAccessSelection = data?.requiresAccessSelection === true;
      const accesosDisponibles = Array.isArray(data?.user?.accesosDisponibles)
        ? (data.user.accesosDisponibles as AccessOption[])
        : [];

      if (requiresAccessSelection && accesosDisponibles.length > 1) {
        const selectedAccess = pickMobileAccess(accesosDisponibles);
        if (selectedAccess?.empresaId && selectedAccess?.rol) {
          const accessUrl = apiPath("auth/empresa-activa");
          const accessRes = await withTimeout(
            fetch(accessUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                empresaId: selectedAccess.empresaId,
                rolActivo: selectedAccess.rol,
              }),
            }),
            12000
          );

          const accessRaw = await accessRes.text();
          let accessData: any = {};
          try {
            accessData = accessRaw ? JSON.parse(accessRaw) : {};
          } catch {
            accessData = { raw: accessRaw };
          }

          if (!accessRes.ok) {
            const msg =
              accessData?.message ||
              accessData?.msg ||
              accessData?.raw ||
              "No se pudo seleccionar el acceso de la app móvil.";
            Alert.alert("Login", msg);
            return;
          }

          token = accessData?.token || token;
          data = accessData?.user ? { ...data, user: accessData.user } : data;
        }
      }

        if (ENABLE_FACE_VERIFY) {
          const faceOk = await verifyFaceWithBackend(token, documento);
          if (!faceOk) return;
        }

      try {
        await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        if (rememberMe) {
          await SecureStore.setItemAsync(SECURE_DOC_KEY, documento, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
        } else {
          await SecureStore.deleteItemAsync(SECURE_DOC_KEY);
        }
        setHasSavedToken(true);


         try {
    const meUrl = apiPath("me");
    const meRes = await fetch(meUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const meRaw = await meRes.text();
    const me = meRaw ? JSON.parse(meRaw) : null;

    if (me) {
      await SecureStore.setItemAsync(
        SECURE_PROFILE_KEY,
        JSON.stringify(me),
        {
          keychainAccessible:
            SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }
      );
    }
  } catch (e) {
    console.log("No se pudo guardar perfil offline:", e);
  }

} catch {}

      const elapsed = Date.now() - start;
      if (elapsed < MIN_LOADING_MS_PASSWORD) {
        await sleep(MIN_LOADING_MS_PASSWORD - elapsed);
      }

      // ✅ REGISTRAR PUSH TOKEN (sin bloquear el login)
      registerPushToken(token).catch((e) =>
        console.log("⚠️ No se pudo registrar push token:", e)
      );

        if (showBiometrics && bioAvailable) {
          Alert.alert(
            `Activar ${bioTypeLabel}`,
            `¿Quieres usar ${bioTypeLabel} para ingresar la próxima vez?`,
          [
            {
              text: "No",
              style: "cancel",
              onPress: () => onLoginSuccess(token),
            },
            {
              text: "Sí, activar",
              onPress: () => {
                Alert.alert(
                  "Listo",
                  `${bioTypeLabel} activado para este dispositivo.`
                );
                onLoginSuccess(token);
              },
            },
          ]
        );
        return;
      }

      onLoginSuccess(token);
    } catch (e: any) {
      const elapsed = Date.now() - start;
      if (elapsed < MIN_LOADING_MS_PASSWORD) {
        await sleep(MIN_LOADING_MS_PASSWORD - elapsed);
      }
      Alert.alert("Error de conexión", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

    async function handleBiometricLogin() {
      try {
      if (!showBiometrics) {
        Alert.alert(
          "Biometría",
          "En Expo Go (iPhone) no está disponible. Funcionará con Dev Build / App Store."
        );
        return;
      }

      const savedToken = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
      const doc = await SecureStore.getItemAsync(SECURE_DOC_KEY);

      if (!savedToken || !doc) {
        Alert.alert(
          "Biometría",
          "Primero inicia sesión una vez para activar biometría."
        );
        return;
      }
      let token: string = savedToken;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Ingresar con ${bioTypeLabel}`,
        cancelLabel: "Cancelar",
        disableDeviceFallback: true,
        requireConfirmation: false,
      });

      if (!result.success) return;

        setLoading(true);
        await sleep(MIN_LOADING_MS_BIO);

        const online = await isOnline();
        if (online) {
          // Face ID desbloquea las credenciales locales, pero no convierte un
          // JWT vencido en una sesión válida. Primero comprobamos el token y,
          // si expiró, pedimos uno nuevo usando la sesión segura del servidor.
          const meResponse = await withTimeout(
            fetch(apiPath("me"), {
              headers: { Authorization: `Bearer ${token}` },
            }),
            12000
          ).catch(() => null);

          if (!meResponse?.ok) {
            const refreshResponse = await withTimeout(
              fetch(apiPath("auth/refresh"), {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              }),
              12000
            ).catch(() => null);

            const refreshRaw = refreshResponse ? await refreshResponse.text() : "";
            let refreshData: any = {};
            try {
              refreshData = refreshRaw ? JSON.parse(refreshRaw) : {};
            } catch {}

            if (!refreshResponse?.ok || !refreshData?.token) {
              await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
              setHasSavedToken(false);
              Alert.alert(
                "Sesión vencida",
                "Por seguridad, ingresa una vez con tu contraseña para renovar el acceso con Face ID."
              );
              return;
            }

            token = refreshData.token;
            await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token, {
              keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            });
          }
        }

        if (ENABLE_FACE_VERIFY) {
          if (online) {
            const faceOk = await verifyFaceWithBackend(token, doc);
            if (!faceOk) return;
          }
        }

      try {
        await registerPushToken(token);
      } catch (e) {
        console.log("⚠️ No se pudo registrar push token (bio):", e);
      }

      onLoginSuccess(token);
    } catch (e: any) {
      Alert.alert("Biometría", e?.message || "No se pudo autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />

        {/* ✅ IMAGEN DE FONDO + DEGRADADO (reemplaza el video) */}
        <ImageBackground
          source={require("../../assets/login.png")}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          <LinearGradient
            colors={["rgba(0,8,20,0.02)", "rgba(0,8,20,0.18)", "rgba(0,8,20,0.82)"]}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>

        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
              <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.card}>
                  <View
                    style={[styles.inputWrap, focusUser && styles.inputWrapFocus]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Cédula"
                      placeholderTextColor="rgba(255,255,255,0.62)"
                      keyboardType="numeric"
                      value={usuario}
                      onChangeText={setUsuario}
                      onFocus={() => setFocusUser(true)}
                      onBlur={() => setFocusUser(false)}
                      editable={!loading}
                      returnKeyType="next"
                    />
                  </View>

                  <View
                    style={[styles.inputWrap, focusPass && styles.inputWrapFocus]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Contraseña"
                      placeholderTextColor="rgba(255,255,255,0.62)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPass}
                      onFocus={() => setFocusPass(true)}
                      onBlur={() => setFocusPass(false)}
                      editable={!loading}
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                    <Pressable
                      onPress={() => setShowPass((s) => !s)}
                      style={styles.eyeBtn}
                      hitSlop={10}
                      disabled={loading}
                    >
                      <Ionicons
                        name={showPass ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color="rgba(255,255,255,0.78)"
                      />
                    </Pressable>
                  </View>

                  <View style={styles.loginOptionsRow}>
                    <Pressable
                      style={styles.rememberBtn}
                      onPress={() => setRememberMe((value) => !value)}
                      disabled={loading}
                    >
                      <View style={[styles.rememberCircle, rememberMe && styles.rememberCircleOn]}>
                        {rememberMe && <View style={styles.rememberDot} />}
                      </View>
                      <Text style={styles.rememberText}>Recordarme</Text>
                    </Pressable>

                    <Pressable onPress={openForgotPassword} style={styles.forgotBtn} disabled={loading}>
                      <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                    </Pressable>
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      canSubmit ? styles.primaryBtnEnabled : styles.primaryBtnDisabled,
                      pressed && canSubmit && { transform: [{ scale: 0.99 }] },
                    ]}
                    onPress={handleLogin}
                    disabled={!canSubmit}
                  >
                    <View style={styles.primaryRow}>
                      <Text style={[styles.primaryText, !canSubmit && styles.primaryTextDisabled]}>Iniciar sesión</Text>
                    </View>
                  </Pressable>

                  <View style={styles.orRow}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>O</Text>
                    <View style={styles.orLine} />
                  </View>

                  {showBiometrics ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.bioBtn,
                        pressed && canBio && { transform: [{ scale: 0.995 }] },
                        !canBio && { opacity: 0.55 },
                      ]}
                      onPress={handleBiometricLogin}
                      disabled={!canBio}
                    >
                      <View style={styles.bioRow}>
                        <MaterialCommunityIcons
                          name={
                            bioTypeLabel === "Face ID"
                              ? "face-recognition"
                              : bioTypeLabel === "Touch ID"
                              ? "fingerprint"
                              : "lock-check-outline"
                          }
                          size={18}
                          color="#ffffff"
                        />
                        <Text style={styles.bioText}>
                          {hasSavedToken
                            ? `Ingresar con ${bioTypeLabel}`
                            : `Activa ${bioTypeLabel} iniciando sesión 1 vez`}
                        </Text>
                      </View>
                    </Pressable>
                  ) : (
                    <View style={styles.hintBox}>
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={16}
                        color="#69717c"
                      />
                      <Text style={styles.hintText}>
                        Face ID no está disponible en Expo Go (iPhone). Funcionará
                        cuando instales la app.
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.version}>Versión 1.0.0</Text>
              </ScrollView>

            {/* ✅ OVERLAY MINIMALISTA */}
            <Modal
              visible={forgotVisible}
              transparent
              animationType="fade"
              onRequestClose={() => resetForgotPasswordState(false)}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.forgotOverlay}>
                  <View style={styles.forgotCard}>
                    <Text style={styles.forgotTitle}>Recuperar contraseña</Text>
                    <Text style={styles.forgotSubtitle}>
                      {forgotStep === 1
                        ? "Ingresa tu correo y te enviaremos un PIN."
                        : forgotStep === 2
                        ? "Ingresa el PIN que llegó a tu correo."
                        : "Crea tu nueva contraseña."}
                    </Text>

                    {forgotStep === 1 ? (
                      <>
                        <Text style={styles.label}>Correo electrónico</Text>
                        <View style={styles.forgotInputWrap}>
                          <TextInput
                            style={styles.forgotInput}
                            placeholder="tu@email.com"
                            placeholderTextColor="rgba(255,255,255,0.55)"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            selectionColor="#8db8ff"
                            value={forgotEmail}
                            onChangeText={setForgotEmail}
                            editable={!forgotLoading}
                          />
                        </View>
                      </>
                    ) : null}

                    {forgotStep === 2 ? (
                      <>
                        <Text style={styles.label}>PIN</Text>
                        <View style={styles.forgotInputWrap}>
                          <TextInput
                            style={styles.forgotInput}
                            placeholder="123456"
                            placeholderTextColor="rgba(255,255,255,0.55)"
                            keyboardType="number-pad"
                            selectionColor="#8db8ff"
                            maxLength={6}
                            value={forgotPin}
                            onChangeText={setForgotPin}
                            editable={!forgotLoading}
                          />
                        </View>
                        <Text style={styles.forgotHint}>El PIN vence en 10 minutos.</Text>
                      </>
                    ) : null}

                    {forgotStep === 3 ? (
                      <>
                        <Text style={styles.label}>Nueva contraseña</Text>
                        <View style={styles.forgotInputWrap}>
                          <TextInput
                            style={styles.forgotInput}
                            placeholder="••••••••"
                            placeholderTextColor="rgba(255,255,255,0.55)"
                            secureTextEntry
                            selectionColor="#8db8ff"
                            value={forgotPassword}
                            onChangeText={setForgotPassword}
                            editable={!forgotLoading}
                          />
                        </View>

                        <Text style={styles.label}>Confirmar contraseña</Text>
                        <View style={styles.forgotInputWrap}>
                          <TextInput
                            style={styles.forgotInput}
                            placeholder="••••••••"
                            placeholderTextColor="rgba(255,255,255,0.55)"
                            secureTextEntry
                            selectionColor="#8db8ff"
                            value={forgotConfirmPassword}
                            onChangeText={setForgotConfirmPassword}
                            editable={!forgotLoading}
                          />
                        </View>
                      </>
                    ) : null}

                    <Pressable
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        pressed && !forgotLoading && { transform: [{ scale: 0.99 }] },
                        forgotLoading && { opacity: 0.7 },
                      ]}
                      onPress={
                        forgotStep === 1
                          ? handleForgotRequestPin
                          : forgotStep === 2
                          ? handleForgotVerifyPin
                          : handleForgotResetPassword
                      }
                      disabled={forgotLoading}
                    >
                      <View style={styles.primaryRow}>
                        <Text style={styles.primaryText}>
                          {forgotLoading
                            ? forgotStep === 1
                              ? "Enviando..."
                              : forgotStep === 2
                              ? "Verificando..."
                              : "Guardando..."
                            : forgotStep === 1
                            ? "Enviar PIN"
                            : forgotStep === 2
                            ? "Verificar PIN"
                            : "Cambiar contraseña"}
                        </Text>
                        {forgotLoading ? (
                          <ActivityIndicator size="small" color="#0b2a17" />
                        ) : (
                          <View style={styles.arrowCircle}>
                            <Ionicons name="arrow-forward" size={18} color="#0b2a17" />
                          </View>
                        )}
                      </View>
                    </Pressable>

                    <View style={styles.forgotActions}>
                      {forgotStep === 2 ? (
                        <Pressable
                          onPress={handleForgotRequestPin}
                          disabled={forgotLoading}
                          style={styles.forgotLinkBtn}
                        >
                          <Text style={styles.forgotLinkText}>Reenviar PIN</Text>
                        </Pressable>
                      ) : null}
                      {forgotStep > 1 ? (
                        <Pressable
                          onPress={() => setForgotStep(1)}
                          disabled={forgotLoading}
                          style={styles.forgotLinkBtn}
                        >
                          <Text style={styles.forgotLinkText}>Cambiar correo</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => resetForgotPasswordState(false)}
                        disabled={forgotLoading}
                        style={styles.forgotLinkBtn}
                      >
                        <Text style={styles.forgotLinkText}>Cerrar</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>

            {loading && (
              <View style={styles.loadingOverlay} pointerEvents="auto">
                <ActivityIndicator size="large" color="#1c897cff" />
                <Text style={styles.loadingText}>Ingresando…</Text>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },

  // ===== WELCOME =====
  welcomeWrap: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: 24,
    justifyContent: "flex-end",
  },
  welcomeCenter: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 22,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
    opacity: 0.95,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    backgroundColor: "rgb(20, 92, 173)",
  },
  brandMini: {
    color: "rgba(255,255,255,0.88)",
    fontFamily: FONT.extrabold,
    letterSpacing: 0.3,
  },
  welcomeTitle: {
    color: "#fff",
    fontSize: 38,
    lineHeight: 42,
    fontFamily: FONT.black,
    letterSpacing: 0.2,
  },
  welcomeSub: {
    marginTop: 10,
    color: "rgba(255,255,255,0.75)",
    fontFamily: FONT.semibold,
    lineHeight: 18,
    maxWidth: 320,
  },
  welcomeActions: {
    paddingTop: 8,
    gap: 12,
  },
  welcomePrimary: {
    backgroundColor: "rgb(16, 140, 189)",
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: "center",
  },
  welcomePrimaryText: {
    color: "#0b2a17",
    fontFamily: FONT.black,
    fontSize: 16,
  },
  welcomeSecondary: {
    borderRadius: 26,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  welcomeSecondaryText: {
    color: "#fff",
    fontFamily: FONT.black,
    fontSize: 16,
  },

  // ===== LOGIN =====
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 190,
    paddingBottom: 122,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  topRow: { marginBottom: 6 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  backText: { color: "#fff", fontFamily: FONT.extrabold },

  hero: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  brand: {
    color: "#fff",
    fontSize: 28,
    fontFamily: FONT.extrabold,
    letterSpacing: 0.8,
    opacity: 0.95,
  },
  heroStats: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 44,
    marginTop: 8,
  },
  heroStat: { color: "#fff", fontSize: 16, fontFamily: FONT.extrabold, textAlign: "center" },
  heroStatSub: { color: "rgba(255,255,255,0.78)", fontSize: 12, fontFamily: FONT.semibold },

  card: {
    width: "100%",
    maxWidth: 480,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    backgroundColor: "rgba(2,12,26,0.58)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },

  label: {
    marginTop: 8,
    color: "rgba(255,255,255,0.9)",
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  inputWrap: {
    marginTop: 10,
    borderRadius: 24,
    paddingHorizontal: 14,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
  },
  inputWrapFocus: {
    backgroundColor: "rgba(255,255,255,0.19)",
    borderColor: "rgba(114,178,255,0.90)",
  },
  input: { flex: 1, color: "#ffffff", fontSize: 15, fontFamily: FONT.regular, paddingVertical: 0 },
  eyeBtn: { paddingLeft: 10 },

  loginOptionsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rememberBtn: { flexDirection: "row", alignItems: "center", gap: 7 },
  rememberCircle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#4bb8ff",
    alignItems: "center",
    justifyContent: "center",
  },
  rememberCircleOn: { borderColor: "#4bb8ff" },
  rememberDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4bb8ff" },
  rememberText: { color: "rgba(255,255,255,0.82)", fontFamily: FONT.semibold, fontSize: 12 },
  forgotBtn: { paddingVertical: 4 },
  forgotText: { color: "rgba(255,255,255,0.82)", fontFamily: FONT.semibold, fontSize: 12 },
  forgotOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  forgotCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "rgba(12,18,28,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  forgotTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: FONT.black,
  },
  forgotSubtitle: {
    marginTop: 8,
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.semibold,
  },
  forgotInputWrap: {
    marginTop: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  forgotInput: {
    width: "100%",
    minHeight: 24,
    color: "#ffffff",
    fontSize: 16,
    fontFamily: FONT.regular,
    padding: 0,
  },
  forgotHint: {
    marginTop: 8,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontFamily: FONT.semibold,
  },
  forgotActions: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  forgotLinkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  forgotLinkText: {
    color: "#8db8ff",
    fontFamily: FONT.bold,
    fontSize: 13,
  },

  primaryBtn: {
    marginTop: 14,
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  primaryBtnEnabled: {
    backgroundColor: "#168fd1",
    borderColor: "#58c7ff",
  },
  primaryBtnDisabled: {
    backgroundColor: "rgba(12, 93, 153, 0.38)",
    borderColor: "rgba(88, 199, 255, 0.72)",
  },
  primaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#ffffff", fontFamily: FONT.bold, fontSize: 16 },
  primaryTextDisabled: { color: "#c6ebff" },
  orRow: { flexDirection: "row", alignItems: "center", marginTop: 12, marginBottom: 2 },
  orLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.28)" },
  orText: { marginHorizontal: 10, color: "#8db8ff", fontFamily: FONT.bold, fontSize: 11 },

  arrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },

  bioBtn: {
    marginTop: 12,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#d9dce3",
    backgroundColor: "#232b38",
  },
  bioRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  bioText: { color: "#fff", fontFamily: FONT.extrabold, fontSize: 14 },

  hintBox: {
    marginTop: 12,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#e1e3e8",
    backgroundColor: "#f5f6f8",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hintText: {
    flex: 1,
    color: "#69717c",
    fontFamily: FONT.semibold,
    fontSize: 12,
    lineHeight: 16,
  },

  version: {
    marginTop: 14,
    textAlign: "center",
    color: "rgba(255,255,255,0.7)",
    fontFamily: FONT.semibold,
  },

  // ✅ OVERLAY minimalista
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 18,
    color: "#fff",
    fontSize: 16,
    fontFamily: FONT.bold,
    letterSpacing: 0.4,
    opacity: 0.9,
  },
});
