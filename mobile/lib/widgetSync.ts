/**
 * widgetSync.ts
 *
 * Writes the current month's financial summary and the active Supabase access
 * token to the iOS App Group UserDefaults so the FinanceWidget extension can
 * read them without making its own auth request.
 *
 * Call syncWidgetData() after:
 *  - Successful login / session refresh
 *  - Any transaction is added, edited, or deleted
 *  - The dashboard mounts / refreshes
 *
 * On Android this is a no-op — SharedGroupPreferences is iOS-only.
 */

import { Platform } from "react-native";
import { supabase } from "./supabase";

const APP_GROUP = "group.com.reduvia.mobile";

// Lazy-import so the module is never evaluated on Android
async function getSharedPrefs() {
  if (Platform.OS !== "ios") return null;
  try {
    const mod = await import("react-native-shared-group-preferences");
    return mod.default ?? mod;
  } catch {
    // Package not linked (e.g. Expo Go) — silently skip
    return null;
  }
}

export async function syncWidgetData(): Promise<void> {
  if (Platform.OS !== "ios") return;

  const prefs = await getSharedPrefs();
  if (!prefs) return;

  try {
    // ── 1. Write the access token so the widget can authenticate ─────────────
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return;

    await prefs.setItem(
      "supabase_access_token",
      session.access_token,
      APP_GROUP
    );

    // ── 2. Compute current-month summary and cache it ─────────────────────────
    // The widget fetches this itself on a 1-hour timer, but pre-caching here
    // means the widget can show a value immediately after app launch.
    const now       = new Date();
    const monthStr  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const { data: rows } = await supabase
      .from("transactions")
      .select("type, amount")
      .gte("created_at", monthStr);

    if (!rows) return;

    let income   = 0;
    let expenses = 0;
    for (const r of rows) {
      if (r.type === "income")  income   += Number(r.amount);
      if (r.type === "expense") expenses += Number(r.amount);
    }

    const summary = JSON.stringify({
      income,
      expenses,
      net:       income - expenses,
      updatedAt: new Date().toISOString(),
    });

    await prefs.setItem("widget_finance_summary", summary, APP_GROUP);
  } catch {
    // Never crash the main app because widget sync failed
  }
}
