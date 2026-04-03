import "react-native-url-polyfill/auto";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import {
  NavigationContainer,
  DarkTheme,
  type Theme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "./lib/supabase";
import { COLORS, type AuthStackParamList, type MainTabParamList } from "./lib/theme";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import DashboardScreen from "./screens/DashboardScreen";
import TransactionsScreen from "./screens/TransactionsScreen";
import BudgetsScreen from "./screens/BudgetsScreen";
import RecurringScreen from "./screens/RecurringScreen";

// ── Custom navigation theme ────────────────────────────────────────────────────
const ReduviaTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: COLORS.purple,
    background: COLORS.bg,
    card: COLORS.surface,
    text: COLORS.text,
    border: COLORS.border,
    notification: COLORS.purple,
  },
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

// ── Auth stack ─────────────────────────────────────────────────────────────────
function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: COLORS.bg },
        animation: "fade",
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

// ── Tab bar icon map ───────────────────────────────────────────────────────────
type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<
  keyof MainTabParamList,
  { active: IoniconsName; inactive: IoniconsName }
> = {
  Dashboard:    { active: "grid",        inactive: "grid-outline" },
  Transactions: { active: "list",        inactive: "list-outline" },
  Budgets:      { active: "wallet",      inactive: "wallet-outline" },
  Recurring:    { active: "repeat",      inactive: "repeat-outline" },
};

// ── Main tab navigator ─────────────────────────────────────────────────────────
function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingBottom: 4,
          height: 60,
        },
        tabBarActiveTintColor: COLORS.purple,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name as keyof MainTabParamList];
          const name = focused ? icons.active : icons.inactive;
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <MainTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "Dashboard" }}
      />
      <MainTab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: "Transactions" }}
      />
      <MainTab.Screen
        name="Budgets"
        component={BudgetsScreen}
        options={{ title: "Budgets" }}
      />
      <MainTab.Screen
        name="Recurring"
        component={RecurringScreen}
        options={{ title: "Recurring" }}
      />
    </MainTab.Navigator>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Resolve the initial persisted session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Keep session in sync with sign-in / sign-out / token refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={COLORS.purple} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={ReduviaTheme}>
        {session ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
