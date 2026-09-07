import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { validateAgainstContract } from "@/lib/validation";
import { pickFacturePatch } from "@/lib/factures";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    validateAgainstContract("uuid", id);

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("cap_factures")
      .select("*")
      .eq("id", id)
      .eq("client_slug", auth.clientSlug)
      .maybeSingle();
    if (error) throw new ApiError(502, "db_error", error.message);
    if (!data) throw new ApiError(404, "not_found", "Facture introuvable");
    return NextResponse.json(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}

/** D6 : validation humaine = transition de statut uniquement. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    validateAgainstContract("uuid", id);

    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      throw new ApiError(400, "invalid_json", "Corps JSON attendu");
    }
    validateAgainstContract("FactureUpdate", body);
    const patch = pickFacturePatch(body);

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("cap_factures")
      .update({ statut: patch.statut, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("client_slug", auth.clientSlug)
      .select()
      .maybeSingle();
    if (error) throw new ApiError(502, "db_error", error.message);
    if (!data) throw new ApiError(404, "not_found", "Facture introuvable");
    return NextResponse.json(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}
