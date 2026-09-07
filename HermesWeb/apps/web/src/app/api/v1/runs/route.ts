import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { parsePagination } from "@/lib/params";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** D11 : la traçabilité du pipeline silencieux = consultation des runs. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const { limit, offset } = parsePagination(
      new URL(req.url).searchParams
    );

    const admin = getAdminClient();
    const { data, error, count } = await admin
      .from("cap_pipeline_runs")
      .select("*", { count: "exact" })
      .eq("client_slug", ctx.clientSlug)
      .order("run_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new ApiError(502, "db_error", error.message);

    return NextResponse.json({ items: data, total: count ?? data.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}
