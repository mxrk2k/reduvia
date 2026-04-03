import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { supabase } from "../lib/supabase";
import { COLORS, type AuthStackParamList } from "../lib/theme";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    // On success the onAuthStateChange listener in App.tsx will swap to MainNavigator
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Text style={styles.brand}>Reduvia</Text>
        <Text style={styles.tagline}>Personal Finance</Text>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to your account</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
            style={styles.btnWrapper}
          >
            <LinearGradient
              colors={["#7c3aed", "#2563eb"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.btn}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Sign in</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("Signup")}
            style={styles.switchRow}
          >
            <Text style={styles.switchText}>
              Don't have an account?{" "}
              <Text style={styles.switchLink}>Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 4,
  },
  brand: {
    fontSize: 36,
    fontWeight: "900",
    color: COLORS.text,
    letterSpacing: 6,
    textShadowColor: COLORS.purple,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    marginBottom: 2,
  },
  tagline: {
    fontSize: 12,
    color: COLORS.muted,
    letterSpacing: 3,
    marginBottom: 32,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "rgba(9,9,30,0.72)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.22)",
    borderRadius: 16,
    padding: 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  sub: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 20,
  },
  errorText: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
    borderRadius: 8,
    padding: 10,
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    color: "rgba(241,245,249,0.6)",
    marginBottom: 6,
  },
  input: {
    height: 44,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 15,
    marginBottom: 16,
  },
  btnWrapper: {
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 4,
  },
  btn: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  switchRow: {
    marginTop: 20,
    alignItems: "center",
  },
  switchText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  switchLink: {
    color: "#a78bfa",
  },
});
