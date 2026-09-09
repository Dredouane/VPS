import { S3, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ApiError } from "./api-error";
import { r2Config } from "./env";

/**
 * URL signée R2 pour les documents archivés (bruts email + PJ).
 * Fix TKT-109-b : SigV4 via le SDK officiel — `aws4fetch` signait
 * X-Amz-Expires comme header signé (valeur vide dans le canonical request)
 * → R2 répondait SignatureDoesNotMatch. En presigned SigV4, les signed
 * headers sont `host` uniquement ; X-Amz-Expires est un query param géré
 * par getSignedUrl. Jamais de x-amz-security-token (credentials R2 = paire
 * access/secret, sans session token — le TOKEN Cloudflare REST n'est PAS un
 * credential S3, leçon pipeline du 01/09).
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
  // Pas d'encodage des segments : le SDK signe la clé telle quelle (les
  // slashs de sous-dossiers restent des slashs).
  const client = new S3({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    { expiresIn: ttlSeconds }
  );
  return {
    url,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };
}
