import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { chatComplete, embedText, type ChatPassage } from "@/lib/gemini";
import { validateAgainstContract } from "@/lib/validation";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Assistant « poser une question » sur UNE conversation (TKT-107) :
 * - isolation stricte au fil courant (C7) : la chaîne est vérifiée
 *   client_slug + la recherche vectorielle est thread-scopée (SQL) ;
 * - honnêteté (C6) : system prompt strict, réponse « pas l'info » si absent ;
 * - historique persistant côté serveur (app_chat_messages, décision D-A).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ threadId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { threadId } = await ctx.params;
    const tid = decodeURIComponent(threadId).trim();
    if (!tid) throw new ApiError(400, "invalid_param", "threadId requis");

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

    // Chaîne vérifiée (appartenance client) — 404 sinon
    const { data: chain, error: chainErr } = await admin
      .from("cap_email_chains")
      .select("thread_id")
      .eq("client_slug", auth.clientSlug)
      .eq("thread_id", tid)
      .maybeSingle();
    if (chainErr) throw new ApiError(502, "db_error", chainErr.message);
    if (!chain) throw new ApiError(404, "not_found", "Chaîne introuvable");

    // Historique récent (contexte de conversation)
    const { data: past, error: pastErr } = await admin
      .from("app_chat_messages")
      .select("role, content")
      .eq("client_slug", auth.clientSlug)
      .eq("thread_id", tid)
      .order("created_at", { ascending: false })
      .limit(20);
    if (pastErr) throw new ApiError(502, "db_error", pastErr.message);
    const history = (past ?? [])
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    // Recherche vectorielle thread-scopée (SQL, C7)
    const embedding = await embedText(question);
    const { data: hits, error: searchErr } = await admin.rpc(
      "rpc_web_doc_search",
      {
        p_client_slug: auth.clientSlug,
        p_query_embedding: embedding,
        p_match_count: 8,
        p_kind: null,
        p_thread_id: tid,
      }
    );
    if (searchErr) throw new ApiError(502, "search_failed", searchErr.message);

    interface SearchHit {
      id: string;
      kind: string;
      title: string | null;
      content: string;
      similarity: number;
    }
    const rows = (hits ?? []) as SearchHit[];

    const passages: ChatPassage[] = rows.map((h) => ({
      kind: h.kind,
      title: h.title,
      content: h.content,
      similarity: h.similarity,
    }));
    const sources = rows.map((h) => ({
      id: h.id,
      kind: h.kind,
      title: h.title,
      similarity: h.similarity,
    }));

    // LLM (Gemini 2.5 Flash)
    const answer = await chatComplete(question, history, passages);

    // Persistance : message user + assistant (avec sources)
    const slug = auth.clientSlug;
    const now = new Date().toISOString();
    const { data: userMsg } = await admin
      .from("app_chat_messages")
      .insert({ client_slug: slug, thread_id: tid, role: "user", content: question })
      .select()
      .single();
    const { data: assistantMsg, error: insertErr } = await admin
      .from("app_chat_messages")
      .insert({
        client_slug: slug,
        thread_id: tid,
        role: "assistant",
        content: answer,
        sources,
        created_at: now,
      })
      .select()
      .single();
    if (insertErr) throw new ApiError(502, "db_error", insertErr.message);
    void userMsg;

    return NextResponse.json(assistantMsg);
  } catch (e) {
    return toErrorResponse(e);
  }
}
