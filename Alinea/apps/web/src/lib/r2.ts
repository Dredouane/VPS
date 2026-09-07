import { AwsClient } from "aws4fetch";

import { ApiError } from "./api-error";
import { r2Config } from "./env";

/**
 * URL signée R2 (SigV4 presigned GET) — les credentials R2 ne quittent
 * jamais le serveur ; le navigateur reçoit une URL à TTL court.
 * Clé R2 attendue dans cap_documents.metadata.r2_key (à produire par le
 * pipeline — évolution notée en DECISIONS).
 */
export async function presignGet(
  key: string,
  ttlSeconds = 900
): Promise<{ url: string; expiresAt: string }> {
  const cfg = r2Config();
  if (!cfg) {
    throw new ApiError(
      503,
      "r2_unconfigured",
      "Variables R2_* manquantes (endpoint, bucket, credentials)"
    );
  }
  const safeKey = key
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    region: "auto",
    service: "s3",
  });
  const objectUrl = `${cfg.endpoint.replace(/\/$/, "")}/${cfg.bucket}/${safeKey}`;
  const signed = await client.sign(
    new Request(objectUrl, {
      method: "GET",
      headers: { "X-Amz-Expires": String(ttlSeconds) },
    }),
    { aws: { signQuery: true } }
  );
  return {
    url: signed.url,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };
}
