import { redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { Shell } from "./shell";

/** Garde d'accès : session + app_users actif, sinon /login. */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let ctx;
  try {
    ctx = await requireAuth();
  } catch {
    redirect("/login");
  }

  let clientNom: string | null = null;
  try {
    const { getAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await getAdminClient()
      .from("cap_clients")
      .select("nom")
      .eq("slug", ctx.clientSlug)
      .maybeSingle();
    clientNom = data?.nom ?? null;
  } catch {
    // service key absente en dev — le shell reste utilisable
  }

  return (
    <Shell email={ctx.email} role={ctx.role as string} clientNom={clientNom}>
      {children}
    </Shell>
  );
}
