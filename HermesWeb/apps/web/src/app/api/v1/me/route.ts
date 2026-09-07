import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { toErrorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const admin = getAdminClient();
    const { data: client } = await admin
      .from("cap_clients")
      .select("nom")
      .eq("slug", ctx.clientSlug)
      .maybeSingle();
    return NextResponse.json({
      user_id: ctx.userId,
      email: ctx.email,
      role: ctx.role,
      client_slug: ctx.clientSlug,
      client_nom: client?.nom ?? null,
      actif: ctx.actif,
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
