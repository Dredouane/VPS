import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { validateAgainstContract } from "@/lib/validation";
import {
  pickFacturePatch,
  pickFactureCorrection,
  buildAuditEntry,
  FACTURE_EDITABLE_FIELDS,
} from "@/lib/factures";
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

/** Deux actions distinctes : transition de statut (D6) OU correction de valeurs (TKT-108). */
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

    const admin = getAdminClient();

    // 1) Transition de statut (D6) — statut seul dans le corps
    if ("statut" in body) {
      if (FACTURE_EDITABLE_FIELDS.some((f) => f in body)) {
        throw new ApiError(
          400,
          "mixed_operation",
          "Correction de valeurs et transition de statut sont deux actions distinctes"
        );
      }
      const patch = pickFacturePatch(body);
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
    }

    // 2) Correction de valeurs (TKT-108) — champs métier seuls + audit
    const patch = pickFactureCorrection(body);
    const { data: before, error: readErr } = await admin
      .from("cap_factures")
      .select("*")
      .eq("id", id)
      .eq("client_slug", auth.clientSlug)
      .maybeSingle();
    if (readErr) throw new ApiError(502, "db_error", readErr.message);
    if (!before) throw new ApiError(404, "not_found", "Facture introuvable");

    const auditEntry = buildAuditEntry(auth.email, before, patch);
    // Le pipeline stocke extraction en STRING JSON — parser si nécessaire
    const rawExtraction = before.extraction;
    const extraction = (
      typeof rawExtraction === "string"
        ? JSON.parse(rawExtraction)
        : rawExtraction ?? {}
    ) as Record<string, unknown>;
    const audit = Array.isArray(extraction.audit) ? extraction.audit : [];
    const updatedExtraction = { ...extraction, audit: [...audit, auditEntry] };

    const { data, error } = await admin
      .from("cap_factures")
      .update({
        ...patch,
        extraction: updatedExtraction,
        updated_at: new Date().toISOString(),
      })
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
