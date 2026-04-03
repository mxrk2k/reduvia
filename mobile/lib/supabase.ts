import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xaarkbivfholdecznwkx.supabase.co";
const SUPABASE_ANON_KEY =
  "sb_publishable_ZNWBu_K6c7yLS4pIWy9pmQ_POzNtoDF";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
