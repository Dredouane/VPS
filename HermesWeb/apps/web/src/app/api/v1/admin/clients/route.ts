import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth, requireRole } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { parsePagination } from "@/lib/params";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Registry clients (lecture admin uniquement — gérée par le runner, D7-ter). */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    requireRole(ctx, ["admin"]);
    const { limit, offset } = parsePagination(
      new URL(req.url).searchParams
    );

    const admin = getAdminClient();
    const { data, error, count } = await admin
      .from("cap_clients")
      .select("*", { count: "exact" })
      .order("slug")
      .range(offset, offset + limit - 1);
    if (error) throw new ApiError(502, "db_error", error.message);

    return NextResponse.json({ items: data, total: count ?? data.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}
