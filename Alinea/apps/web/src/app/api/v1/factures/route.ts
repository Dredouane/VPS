import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { parseEnumParam, parsePagination } from "@/lib/params";
import { getAdminClient } from "@/lib/supabase/admin";
import { FACTURE_STATUTS } from "@/lib/enums";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    const sp = new URL(req.url).searchParams;
    const { limit, offset } = parsePagination(sp);
    const statut = parseEnumParam(sp, "statut", FACTURE_STATUTS);

    const admin = getAdminClient();
    let query = admin
      .from("cap_factures")
      .select("*", { count: "exact" })
      .eq("client_slug", ctx.clientSlug);
    if (statut) query = query.eq("statut", statut);
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new ApiError(502, "db_error", error.message);

    return NextResponse.json({ items: data, total: count ?? data.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}
