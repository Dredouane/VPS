# Decision — Capability ged-r2

> Règle d'ordre : **NATIF > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Besoin

Archiver les **fichiers bruts** de chaque email traité (thread.json +
pièces jointes) vers la GED Cloudflare R2 — appel générique en fin
d'extraction email, **slug en sous-dossier** pour distinguer les clients
(exigence 01/09). Copie de référence des documents bruts avant RAG.

## Options évaluées

| Option | Verdict |
|---|---|
| **Mix** : client S3 SigV4 en code stdlib (hmac/hashlib) vers R2 | ✅ **retenu** |
| Librairie boto3 | ❌ pip dans le conteneur (viole I11) |
| Sidecar MinIO client / worker dédié | ❌ sur-ingénierie pour un PUT/GET |
| Archivage local seulement (spool) | ❌ le spool n'est pas un stockage durable |

## Décision

**MIX** — `r2_client.py` implémente **AWS SigV4 en stdlib** (hmac/hashlib),
validé contre le **vecteur officiel AWS SigV4 test suite** (signature
attendue bit-à-bit) ET **en réel** sur le bucket (put 200 → head → get →
delete 204 → head absent). Auth = ACCESS_KEY_ID + SECRET uniquement — le
`VPS_GED_CLOUDFLARE_TOKEN` est un token API Cloudflare (REST), **pas** un
session token S3 (R2 rejette x-amz-security-token — vérifié 01/09).

Clé R2 déterministe : `<GED_EMAIL_PREFIX>/<slug>/emails/<thread_id>/<fichier>`
(le slug distingue les clients). Upload idempotent (overwrite), `head` pour
l'audit, `delete` réservé au nettoyage de tests (`_hermes-test/`).

Plan B : boto3 si complexité S3 future (list/versions) — reviendrait sur I11,
à qualifier avant.

## Re-vérification

| Date | Hermes | Verdict inchangé ? | Notes |
|---|---|---|---|
| 2026-09-01 | v0.20.6 | — (décision initiale) | réel OK sur bucket suren-saas-ged |
