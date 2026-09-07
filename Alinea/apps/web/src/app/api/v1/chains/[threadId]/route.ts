import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ChainMail = {
  email: Record<string, unknown>;
  content: Record<string, unknown> | null;
  attachments: Record<string, unknown>[];
};

/**
 * Détail composite d'une chaîne (WEBAPP_DATA_MAPPING.md §5) :
 * chaîne + mails chronologiques (mail_date) avec contenu (kind=email,
 * join message_id) et PJ (parent_message_id) + factures liées
 * (email_message_id ∈ mails). Scoping client_slug systématique.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ threadId: string }> }
) {
  try {
    const auth = await requireAuth();
    const { threadId } = await ctx.params;
    const tid = decodeURIComponent(threadId).trim();
    if (!tid) throw new ApiError(400, "invalid_param", "threadId requis");

    const admin = getAdminClient();

    const { data: chain, error: chainErr } = await admin
      .from("cap_email_chains")
      .select("*")
      .eq("client_slug", auth.clientSlug)
      .eq("thread_id", tid)
      .maybeSingle();
    if (chainErr) throw new ApiError(502, "db_error", chainErr.message);
    if (!chain) throw new ApiError(404, "not_found", "Chaîne introuvable");

    const { data: mails, error: mailsErr } = await admin
      .from("cap_emails")
      .select("*")
      .eq("client_slug", auth.clientSlug)
      .eq("thread_id", tid)
      .order("mail_date", { ascending: true, nullsFirst: false });
    if (mailsErr) throw new ApiError(502, "db_error", mailsErr.message);

    const { data: docs, error: docsErr } = await admin
      .from("cap_documents")
      .select("*")
      .eq("client_slug", auth.clientSlug)
      .eq("thread_id", tid)
      .order("created_at", { ascending: true })
      .limit(200);
    if (docsErr) throw new ApiError(502, "db_error", docsErr.message);

    const messageIds = (mails ?? []).map((m) => m.message_id);
    const { data: factures, error: factErr } = await admin
      .from("cap_factures")
      .select("*")
      .eq("client_slug", auth.clientSlug)
      .in("email_message_id", messageIds.length > 0 ? messageIds : ["__none__"]);
    if (factErr) throw new ApiError(502, "db_error", factErr.message);

    const chainMails: ChainMail[] = (mails ?? []).map((mail) => ({
      email: mail,
      content:
        (docs ?? []).find(
          (d) =>
            d.kind === "email" &&
            (d as { message_id?: string }).message_id === mail.message_id
        ) ?? null,
      attachments: (docs ?? []).filter(
        (d) =>
          d.kind === "attachment" &&
          (d as { parent_message_id?: string | null }).parent_message_id ===
            mail.message_id
      ),
    }));

    return NextResponse.json({
      chain,
      mails: chainMails,
      factures: factures ?? [],
    });
  } catch (e) {
    return toErrorResponse(e);
  }
}
