import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { ApiError } from "../api-error";
import { supabaseEnv } from "../env";

/** Client Supabase côté session (cookies @supabase/ssr) — lecture auth. */
export async function createSessionClient() {
  const env = supabaseEnv();
  if (!env) {
    throw new ApiError(
      503,
      "supabase_unconfigured",
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes"
    );
  }
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // appelé depuis un Server Component — ignoré (middleware gère)
        }
      },
    },
  });
}
