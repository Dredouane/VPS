import { ApiError } from "./api-error";
import { getAdminClient } from "./supabase/admin";
import { createSessionClient } from "./supabase/server";
import { APP_USER_ROLES } from "./enums";

/** Contexte d'authentification webapp : session Supabase + ligne app_users. */
export interface AuthContext {
  userId: string;
  email: string;
  role: (typeof APP_USER_ROLES)[number] | (string & {});
  clientSlug: string;
  actif: boolean;
}

/**
 * Résout l'utilisateur connecté (cookie de session Supabase) et son mapping
 * webapp (app_users : rôle + client_slug). 401 sans session, 403 sans accès
 * webapp actif — le slug du client vient TOUJOURS du user, jamais de la requête.
 */
export async function requireAuth(): Promise<AuthContext> {
  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  if (!user?.email) {
    throw new ApiError(401, "unauthenticated", "Session Supabase requise");
  }

  const admin = getAdminClient();
  const { data: appUser, error } = await admin
    .from("app_users")
    .select("role, client_slug, actif")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    throw new ApiError(502, "app_user_lookup_failed", error.message);
  }
  if (!appUser || !appUser.actif) {
    throw new ApiError(
      403,
      "not_authorized",
      "Aucun accès webapp actif pour ce compte"
    );
  }

  return {
    userId: user.id,
    email: user.email,
    role: appUser.role,
    clientSlug: appUser.client_slug,
    actif: appUser.actif,
  };
}

export function requireRole(
  ctx: AuthContext,
  roles: readonly string[]
): void {
  if (!roles.includes(ctx.role as string)) {
    throw new ApiError(403, "forbidden", `Rôle requis : ${roles.join(" ou ")}`);
  }
}
