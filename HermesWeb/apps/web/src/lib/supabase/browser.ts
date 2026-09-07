"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Client Supabase navigateur (login/logout) — clé publishable uniquement. */
export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
