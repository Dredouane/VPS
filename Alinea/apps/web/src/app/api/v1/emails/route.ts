import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { parseEnumParam, parsePagination } from "@/lib/params";
import { getAdminClient } from "@/lib/supabase/admin";
import { EMAIL_STATUSES } from "@/lib/enums";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const sp = new URL(req.url).searchParams;
    const { limit, offset } = parsePagination(sp);
    const status = parseEnumParam(sp, "status", EMAIL_STATUSES);
    const threadId = sp.get("thread_id") ?? undefined;

    const admin = getAdminClient();
    let query = admin
      .from("cap_emails")
      .select("*", { count: "exact" })
      .eq("client_slug", ctx.clientSlug);
    if (status) query = query.eq("status", status);
    if (threadId) query = query.eq("thread_id", threadId);
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new ApiError(502, "db_error", error.message);

    return NextResponse.json({ items: data, total: count ?? data.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}
