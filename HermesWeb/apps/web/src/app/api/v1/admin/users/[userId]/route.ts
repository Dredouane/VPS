import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth, requireRole } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { validateAgainstContract } from "@/lib/validation";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requireAuth();
    requireRole(auth, ["admin"]);
    const { userId } = await ctx.params;
    validateAgainstContract("uuid", userId);

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("app_users")
      .delete()
      .eq("user_id", userId)
      .select()
      .maybeSingle();
    if (error) throw new ApiError(502, "db_error", error.message);
    if (!data) throw new ApiError(404, "not_found", "Utilisateur introuvable");
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
