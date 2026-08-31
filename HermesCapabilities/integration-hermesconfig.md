# 🔌 integration-hermesconfig.md — Contrat d'interface HermesCapabilities ↔ HermesConfig

> Comment la plateforme HermesConfig consomme les capabilities. Ce contrat
> sera implémenté par **spawn-hermes-pro v3** (M3/M4). En M1/M2, l'attachement
> se fait manuellement via `capability-attach.sh`.
> Premier cas d'usage concret : pipeline email AREV — [`PIPELINE_EMAIL_AREV.md`](PIPELINE_EMAIL_AREV.md).

## 1. Flux cible (spawn v3)

```
clients/<slug>/client.env
  ├── CLIENT_SLUG, tokens Telegram, clés LLM        (existant v2)
  ├── CAPABILITIES="rag-supabase email-gmail ..."   (nouveau — liste d'ids)
  └── <SECRETS_DE_CAPABILITIES> (SUPABASE_URL, …)   (validés par les manifests)

spawn-hermes-pro.sh <slug>
  1. Valide client.env (existant) + secrets de TOUTES les capabilities
     listées dans CAPABILITIES (fail-fast avant tout déploiement)
  2. Déploie le conteneur (existant v2 : compose, loopback, image pinnée…)
  3. Attache les capabilities : capability-attach.sh <slug> $CAPABILITIES
     (MCP → skills → routines → soul-addendum → capabilities.yaml)
  4. Health-check + audit final
```

## 2. Responsabilités

| Élément | HermesConfig (plateforme) | HermesCapabilities (compétences) |
|---|---|---|
| Conteneur, réseau, ports, image | ✅ (D1-D10) | — |
| Secrets de base (Telegram, LLM) | ✅ client.env | — |
| Secrets de capabilities | client.env (stockage) | manifests (validation + usage) |
| MCP / skills / routines | injection runtime | définition déclarative |
| SOUL.md de base (identité client) | ✅ `clients/<slug>/soul.md` | addenda par capability (merge marqué) |
| État des capabilities attachées | `instances/<slug>/` | `instances/<slug>/capabilities.yaml` |
| Tests | audit-hermes-pro.sh (flotte) | capability-test.sh (contrats) |

## 3. Règles d'interface

1. **Fail-fast** : un secret de capability manquant bloque le spawn (pas
   d'instance à moitié compétente en prod).
2. **Idempotence** : l'attach est rejouable (marqueurs SOUL.md, state file,
   `hermes mcp add` tolérant au déjà-présent).
3. **Update** : re-spawn = re-attach automatique des capabilities listées
   dans `capabilities.yaml` même si `CAPABILITIES` a disparu du client.env
   (l'état fait foi, à moins de `--detach`).
4. **Rollback capability** : `--detach <cap-id>` (M2) retire MCP/skills/
   routines + bloc SOUL.md marqué + entrée du state file. Les données
   (schéma Supabase) ne sont JAMAIS détruites par un detach.
5. **Drift** : HermesCapabilities sur le VPS est un miroir git (comme
   HermesConfig — invariant I14). Toute modif passe par le repo + rsync.

## 4. Séquence M2 (implémentation réelle C5 sur arev)

```bash
# 1. Secrets test (projet Supabase TEST) dans clients/arev/client.env
#    SUPABASE_URL / SUPABASE_RPC_KEY (rôle capability, RLS)
# 2. Schéma + RPC côté Supabase TEST (voir capabilities/rag-supabase/README.md)
# 3. rsync HermesCapabilities → VPS (miroir)
# 4. Dry-run puis attach :
sudo ./capability-attach.sh arev rag-supabase --dry-run
sudo ./capability-attach.sh arev rag-supabase
# 5. Tests d'intégration (capability-test.sh rag-supabase --vps)
# 6. Validation bout-en-bout : l'agent indexe un document test et le retrouve
```
