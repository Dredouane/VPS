import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { embedText } from "@/lib/gemini";
import { validateAgainstContract } from "@/lib/validation";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Recherche sémantique RAG : embedding requête (miroir pipeline) + rpc_web_doc_search. */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      throw new ApiError(400, "invalid_json", "Corps JSON attendu");
    }
    validateAgainstContract("DocumentSearchRequest", body);

    const embedding = await embedText(body.query as string);
    const admin = getAdminClient();
    const { data, error } = await admin.rpc("rpc_web_doc_search", {
      p_client_slug: ctx.clientSlug,
      p_query_embedding: embedding,
      p_match_count: (body.match_count as number) ?? 5,
      p_kind: (body.kind as string) ?? null,
    });
    if (error) throw new ApiError(502, "search_failed", error.message);

    return NextResponse.json({ items: data });
  } catch (e) {
    return toErrorResponse(e);
  }
}
