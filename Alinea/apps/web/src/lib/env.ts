/** Variables d'environnement — secrets serveur uniquement (jamais NEXT_PUBLIC_*). */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export interface R2Config {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function serviceKey(): string | null {
  return process.env.SUPABASE_SERVICE_KEY ?? null;
}

export function geminiKey(): string | null {
  return process.env.GEMINI_API_KEY ?? null;
}

export function r2Config(): R2Config | null {
  const endpoint = process.env.R2_S3_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}
