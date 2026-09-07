import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api-error";
import { requireAuth, requireRole } from "@/lib/auth";
import { toErrorResponse } from "@/lib/http";
import { parsePagination } from "@/lib/params";
import { validateAgainstContract } from "@/lib/validation";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    requireRole(ctx, ["admin"]);
    const { limit, offset } = parsePagination(
      new URL(req.url).searchParams
    );

    const admin = getAdminClient();
    const { data, error, count } = await admin
      .from("app_users")
      .select("*", { count: "exact" })
      .order("client_slug")
      .range(offset, offset + limit - 1);
    if (error) throw new ApiError(502, "db_error", error.message);

    return NextResponse.json({ items: data, total: count ?? data.length });
  } catch (e) {
    return toErrorResponse(e);
  }
}

/**
 * Mapping d'un compte auth Supabase existant (créé/invité via le dashboard
 * Supabase) vers un client + rôle. user_id doit exister dans auth.users.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAuth();
    requireRole(ctx, ["admin"]);

    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      throw new ApiError(400, "invalid_json", "Corps JSON attendu");
    }
    validateAgainstContract("AppUserInsert", body);

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("app_users")
      .insert({
        user_id: body.user_id as string,
        client_slug: body.client_slug as string,
        ...(typeof body.role === "string" ? { role: body.role } : {}),
        ...(typeof body.actif === "boolean" ? { actif: body.actif } : {}),
      })
      .select()
      .single();
    if (error) {
      const fk = error.code === "23503";
      throw new ApiError(
        fk ? 400 : 502,
        fk ? "unknown_user_or_client" : "db_error",
        error.message
      );
    }
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return toErrorResponse(e);
  }
}
