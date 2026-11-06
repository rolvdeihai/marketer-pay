// mobile/src/lib/supabase.ts
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: {
      storage: AsyncStorage,      // keep the session after the app restarts
      autoRefreshToken: true,     // access tokens expire (~1h); refresh silently
      persistSession: true,
      detectSessionInUrl: false,  // we don't use magic-link redirects
    },
  },
);