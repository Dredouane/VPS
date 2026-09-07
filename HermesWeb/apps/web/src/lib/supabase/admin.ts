import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "../api-error";
import { serviceKey } from "../env";

/**
 * Client service key — SERVER-ONLY (D8-v3 : la webapp opère en service key,
 * RLS deny-all inchangée ; le scoping multi-tenant est appliqué en code via
 * client_slug issu de app_users).
 */
let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = serviceKey();
  if (!url || !key) {
    throw new ApiError(
      503,
      "supabase_unconfigured",
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_KEY manquantes"
    );
  }
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
