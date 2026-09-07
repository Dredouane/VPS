/**
 * Bootstrap admin webapp : crée le user auth Supabase (si absent) + la ligne
 * app_users (role admin). Usage : pnpm tsx scripts/bootstrap-admin.ts <email>
 * REST fetch pur (aucune dépendance, pas de WebSocket requis).
 * Le service key vient de apps/web/.env.local (jamais affichée).
 * Script one-off de mise en service — non utilisé au runtime.
 */
import { readFileSync } from "node:fs";

function loadEnv(): Record<string, string> {
  const envText = readFileSync(
    new URL("../apps/web/.env.local", import.meta.url),
    "utf8"
  );
  return Object.fromEntries(
    envText
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const idx = l.indexOf("=");
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );
}

async function main() {
  const env = loadEnv();
  const email = process.argv[2];
  if (!email) throw new Error("Usage: tsx bootstrap-admin.ts <email>");
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) throw new Error("Env manquantes dans .env.local");

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  // 1) user auth — existe déjà ?
  const listRes = await fetch(`${url}/auth/v1/admin/users?per_page=200`, {
    headers,
  });
  if (!listRes.ok) throw new Error(`listUsers: ${await listRes.text()}`);
  const listJson = (await listRes.json()) as { users: { id: string; email: string }[] };
  const existing = listJson.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  let userId: string;
  let generatedPassword: string | null = null;

  if (existing) {
    userId = existing.id;
    console.log(`user auth existant : ${userId}`);
  } else {
    generatedPassword =
      [...crypto.getRandomValues(new Uint8Array(12))]
        .map(
          (b) => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"[b % 56]
        )
        .join("") + "A1!";
    const createRes = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email,
        password: generatedPassword,
        email_confirm: true,
      }),
    });
    if (!createRes.ok) throw new Error(`createUser: ${await createRes.text()}`);
    const created = (await createRes.json()) as { id: string };
    userId = created.id;
    console.log(`user auth créé : ${userId}`);
  }

  // 2) mapping app_users (role admin, client arev) — upsert REST
  const upsertRes = await fetch(`${url}/rest/v1/app_users?on_conflict=user_id`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([
      { user_id: userId, client_slug: "arev", role: "admin", actif: true },
    ]),
  });
  if (!upsertRes.ok) throw new Error(`app_users: ${await upsertRes.text()}`);
  const rows = (await upsertRes.json()) as {
    role: string;
    client_slug: string;
  }[];
  console.log(
    `app_users OK : role=${rows[0]?.role} slug=${rows[0]?.client_slug}`
  );

  if (generatedPassword) {
    console.log(`MOT DE PASSE (à changer) : ${generatedPassword}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
