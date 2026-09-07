import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { validateAgainstContract } from "@/lib/validation";
import { presignGet } from "@/lib/r2";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * URL signée R2 pour le brut d'un document. La clé est lue dans
 * cap_documents.metadata.r2_key (à produire par le pipeline — évolution
 * notée en DECISIONS W9) ; sans clé → 404 r2_key_unavailable.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ documentId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { documentId } = await ctx.params;
    validateAgainstContract("uuid", documentId);

    const admin = getAdminClient();
    const { data: doc, error } = await admin
      .from("cap_documents")
      .select("metadata")
      .eq("id", documentId)
      .eq("client_slug", auth.clientSlug)
      .maybeSingle();
    if (error) throw new ApiError(502, "db_error", error.message);
    if (!doc) throw new ApiError(404, "not_found", "Document introuvable");

    const metadata = doc.metadata as Record<string, unknown> | null;
    const r2Key =
      metadata && typeof metadata.r2_key === "string"
        ? metadata.r2_key
        : null;
    if (!r2Key) {
      throw new ApiError(
        404,
        "r2_key_unavailable",
        "Aucune clé R2 enregistrée pour ce document"
      );
    }

    const presigned = await presignGet(r2Key);
    return NextResponse.json(presigned);
  } catch (e) {
    return toErrorResponse(e);
  }
}
