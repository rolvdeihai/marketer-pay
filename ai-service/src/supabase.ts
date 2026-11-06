// ai-service/src/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Server-side client with the SECRET key: bypasses RLS. Never ship this key to a browser/app.
export const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});