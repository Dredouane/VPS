import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { parseEnumParam, parsePagination } from "@/lib/params";
import { DOCUMENT_KINDS } from "@/lib/enums";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const sp = new URL(req.url).searchParams;
    const { limit, offset } = parsePagination(sp);
    const threadId = sp.get("thread_id") ?? undefined;
    const messageId = sp.get("message_id") ?? undefined;
    const parentMessageId = sp.get("parent_message_id") ?? undefined;
    const kind = sp.get("kind") ?? undefined;
    if (kind && !DOCUMENT_KINDS.includes(kind as "email" | "attachment")) {
      throw new ApiError(400, "invalid_param", "kind doit être : email | attachment");
    }

    const admin = getAdminClient();
    let query = admin
      .from("cap_documents")
      .select("*", { count: "exact" })
      .eq("client_slug", ctx.clientSlug);
    if (threadId) query = query.eq("thread_id", threadId);
    if (messageId) query = query.eq("message_id", messageId);
    if (parentMessageId) query = query.eq("parent_message_id", parentMessageId);
    if (kind) query = query.eq("kind", kind);
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new ApiError(502, "db_error", error.message);

    return NextResponse.json({ items: data, total: count ?? data.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}
