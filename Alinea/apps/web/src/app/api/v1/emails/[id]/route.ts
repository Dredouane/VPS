import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { validateAgainstContract } from "@/lib/validation";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    validateAgainstContract("uuid", id);

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("cap_emails")
      .select("*")
      .eq("id", id)
      .eq("client_slug", auth.clientSlug)
      .maybeSingle();
    if (error) throw new ApiError(502, "db_error", error.message);
    if (!data) throw new ApiError(404, "not_found", "Email introuvable");
    return NextResponse.json(data);
  } catch (e) {
    return toErrorResponse(e);
  }
}
