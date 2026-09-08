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

    // Liens actionnables (TKT-210) : chaîne d'origine + facture liée
    const rows = (data ?? []) as {
      id: string;
      kind: string;
      title: string | null;
      content: string;
      metadata: Record<string, unknown> | null;
      similarity: number;
    }[];
    const hitIds = rows.map((h) => h.id);

    let docsByHit = new Map<
      string,
      { thread_id: string | null; message_id: string | null }
    >();
    if (hitIds.length > 0) {
      const { data: docs } = await admin
        .from("cap_documents")
        .select("id, thread_id, message_id")
        .in("id", hitIds);
      docsByHit = new Map(
        (docs ?? []).map((d) => [
          d.id,
          { thread_id: d.thread_id, message_id: d.message_id },
        ])
      );
    }
    const docMessageIds = [...docsByHit.values()]
      .map((d) => d.message_id)
      .filter((m): m is string => !!m);
    const factureByDoc = new Map<string, { id: string; numero: string }>();
    const factureByMsg = new Map<string, { id: string; numero: string }>();
    if (hitIds.length > 0 || docMessageIds.length > 0) {
      const orParts = [
        hitIds.length > 0 ? `document_id.in.(${hitIds.join(",")})` : null,
        docMessageIds.length > 0
          ? `email_message_id.in.(${docMessageIds.map((m) => `"${m}"`).join(",")})`
          : null,
      ].filter(Boolean);
      const { data: factures, error: factErr } = await admin
        .from("cap_factures")
        .select("id, numero, document_id, email_message_id")
        .eq("client_slug", ctx.clientSlug)
        .or(orParts.join(","));
      if (!factErr) {
        for (const f of factures ?? []) {
          if (f.document_id) factureByDoc.set(f.document_id, f);
          if (f.email_message_id) factureByMsg.set(f.email_message_id, f);
        }
      }
    }

    const items = rows.map((h) => {
      const doc = docsByHit.get(h.id);
      const facture =
        factureByDoc.get(h.id) ??
        (doc?.message_id ? factureByMsg.get(doc.message_id) : undefined);
      return {
        ...h,
        thread_id: doc?.thread_id ?? null,
        facture_id: facture?.id ?? null,
        facture_numero: facture?.numero ?? null,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    return toErrorResponse(e);
  }
}
