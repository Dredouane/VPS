import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import {
  chatComplete,
  embedText,
  type ChatPassage,
} from "@/lib/gemini";
import { validateAgainstContract } from "@/lib/validation";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const CHAT_KEY_PREFIX = "facture:";

/** Historique du chat expert d'une facture (clé app_chat_messages = facture:<id>). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    validateAgainstContract("uuid", id);

    const admin = getAdminClient();
    const { data: facture } = await admin
      .from("cap_factures")
      .select("id")
      .eq("id", id)
      .eq("client_slug", auth.clientSlug)
      .maybeSingle();
    if (!facture) throw new ApiError(404, "not_found", "Facture introuvable");

    const key = `${CHAT_KEY_PREFIX}${id}`;
    const { data, error, count } = await admin
      .from("app_chat_messages")
      .select("*", { count: "exact" })
      .eq("client_slug", auth.clientSlug)
      .eq("thread_id", key)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new ApiError(502, "db_error", error.message);

    return NextResponse.json({ items: data, total: count ?? data.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/**
 * Assistant expert d'une facture (TKT-203) : contexte = fiche affichée +
 * documents du thread lié (isolation par facture). Historique persistant
 * (app_chat_messages, clé facture:<id>).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
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
    validateAgainstContract("ChatRequest", body);
    const question = (body.question as string).trim();

    const admin = getAdminClient();

    const { data: facture, error: factErr } = await admin
      .from("cap_factures")
      .select("*")
      .eq("id", id)
      .eq("client_slug", auth.clientSlug)
      .maybeSingle();
    if (factErr) throw new ApiError(502, "db_error", factErr.message);
    if (!facture) throw new ApiError(404, "not_found", "Facture introuvable");

    // Thread lié : document_id → cap_documents.thread_id, sinon email_message_id
    let threadId: string | null = null;
    if (facture.document_id) {
      const { data: doc } = await admin
        .from("cap_documents")
        .select("thread_id")
        .eq("id", facture.document_id)
        .maybeSingle();
      threadId = doc?.thread_id ?? null;
    }
    if (!threadId && facture.email_message_id) {
      const { data: mail } = await admin
        .from("cap_emails")
        .select("thread_id")
        .eq("message_id", facture.email_message_id)
        .eq("client_slug", auth.clientSlug)
        .maybeSingle();
      threadId = mail?.thread_id ?? null;
    }

    // Contexte : fiche (toujours) + passages thread-scopés si un fil existe
    interface SearchHit {
      id: string;
      kind: string;
      title: string | null;
      content: string;
      similarity: number;
    }
    let searchHits: SearchHit[] = [];
    const passages: ChatPassage[] = [];
    passages.push({
      kind: "fiche",
      title: `Facture ${facture.numero}`,
      content: `Fiche facture enregistrée (source de vérité côté webapp) :
numéro: ${facture.numero}
fournisseur: ${facture.fournisseur || "(absent)"}
identifiant fournisseur: ${facture.fournisseur_identifiant || "(absent)"}
objet: ${facture.objet || "(absent)"}
date facture: ${facture.date_facture || "(absent)"}
échéance: ${facture.date_echeance || "(absent)"}
montant HT: ${facture.montant_ht ?? "(absent)"} — TVA: ${facture.montant_tva ?? "(absent)"} — TTC: ${facture.montant_ttc ?? "(absent)"} ${facture.devise}
statut: ${facture.statut}
confiance extraction: ${facture.confiance ?? "(absent)"}
email d'origine (message id): ${facture.email_message_id || "(absent)"}`,
      similarity: 1,
    });
    if (threadId) {
      const embedding = await embedText(question);
      const { data: hits, error: searchErr } = await admin.rpc(
        "rpc_web_doc_search",
        {
          p_client_slug: auth.clientSlug,
          p_query_embedding: embedding,
          p_match_count: 8,
          p_kind: null,
          p_thread_id: threadId,
        }
      );
      if (searchErr) throw new ApiError(502, "search_failed", searchErr.message);
      searchHits = (hits ?? []) as SearchHit[];
      for (const h of searchHits) {
        passages.push({
          kind: h.kind,
          title: h.title,
          content: h.content,
          similarity: h.similarity,
        });
      }
    }

    // Message user persisté d'abord (traçabilité, ordre chronologique)
    const key = `${CHAT_KEY_PREFIX}${id}`;
    await admin.from("app_chat_messages").insert({
      client_slug: auth.clientSlug,
      thread_id: key,
      role: "user",
      content: question,
    });
    const { data: past, error: pastErr } = await admin
      .from("app_chat_messages")
      .select("role, content")
      .eq("client_slug", auth.clientSlug)
      .eq("thread_id", key)
      .order("created_at", { ascending: false })
      .limit(20);
    if (pastErr) throw new ApiError(502, "db_error", pastErr.message);
    const history = (past ?? [])
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const answer = await chatComplete(question, history, passages);

    const rows_sources = passages.map((p, i) => ({
      id: i === 0 ? id : (searchHits[i - 1]?.id ?? id),
      kind: p.kind === "fiche" ? "email" : p.kind,
      title: p.title,
      similarity: p.similarity,
    }));
    const { data: assistantMsg, error: insertErr } = await admin
      .from("app_chat_messages")
      .insert({
        client_slug: auth.clientSlug,
        thread_id: key,
        role: "assistant",
        content: answer,
        sources: rows_sources,
      })
      .select()
      .single();
    if (insertErr) throw new ApiError(502, "db_error", insertErr.message);

    return NextResponse.json(assistantMsg);
  } catch (e) {
    return toErrorResponse(e);
  }
}
