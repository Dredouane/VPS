# Capability ged-r2 — archivage R2 des emails bruts

**Type** : `mix` · **Statut** : M2.2-ter — SigV4 stdlib validé (vecteur AWS +
réel), save slug-scopé opérationnel

Sauvegarde générique des fichiers bruts email (thread.json + PJ) vers
**Cloudflare R2** (S3-compatible, SigV4 **stdlib** — aucun pip), appelée à la
fin de l'extraction email. Clé R2 : `<GED_EMAIL_PREFIX>/<slug>/emails/<thread_id>/<fichier>`
— le slug distingue les clients (exigence 01/09).

## Composants

| Fichier | Rôle |
|---|---|
| [manifest.yaml](manifest.yaml) | Contrat : secrets R2, code [r2_client, ged_save] |
| [decision.md](decision.md) | Mix SigV4 stdlib — token API ≠ session token S3 (vérifié) |
| [code/r2_client.py](code/r2_client.py) | SigV4 (vecteur AWS test suite ✓) + put/get/head/delete |
| [code/ged_save.py](code/ged_save.py) | Save d'un dossier thread → R2 (slug-scopé) |
| [soul-addendum.md](soul-addendum.md) | Refus : autres slugs, contenu hors spool, R2 ≠ source primaire |
| [tests/test.sh](tests/test.sh) | SigV4 vecteur AWS + intégration réelle put/get/head/delete |

## Secrets requis (dans `HermesConfig/clients/<slug>/client.env`, 600)

| Variable | Rôle |
|---|---|
| `VPS_GED_CLOUDFLARE_S3_EU_ENDPOINT` | Endpoint R2 (eu.r2.cloudflarestorage.com) |
| `VPS_GED_CLOUDFLARE_BUCKET_NAME` | Bucket GED |
| `VPS_GED_CLOUDFLARE_ACCESS_KEY_ID` | Clé d'accès R2 |
| `VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY` | Secret R2 |
| `VPS_GED_CLOUDFLARE_TOKEN` | Token API Cloudflare (REST) — **non utilisé par S3** |

Env : `CLIENT_SLUG` (déjà dans client.env), `GED_EMAIL_PREFIX=emails`.

## Coûts / quotas

R2 : stockage class A/B par opérations — polling + PJ volumineuses à
surveiller (estimation par client dans DEPLOYMENT.md).

## Historique

- 2026-09-01 : création (exigence utilisateur — archivage R2 en fin
  d'extraction email) ; SigV4 stdlib validé réel.
