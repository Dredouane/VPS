import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Historique persistant du chat d'une conversation (ascendant). */
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
    const { data, error, count } = await admin
      .from("app_chat_messages")
      .select("*", { count: "exact" })
      .eq("client_slug", auth.clientSlug)
      .eq("thread_id", tid)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new ApiError(502, "db_error", error.message);

    return NextResponse.json({ items: data, total: count ?? data.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}
