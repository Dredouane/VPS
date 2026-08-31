# 🧩 HermesCapabilities — Compétences modulaires des agents Hermes

Sous-projet **volet 2/3** de la fabrique Hermes :

1. **HermesConfig** (`../HermesConfig/`) — plateforme de création/update des agents (Docker fleet v2, sécurité, isolation, clients variabilisés)
2. **HermesCapabilities** *(ce dossier)* — les **capabilities** : compétences granulaires (email, OCR, RAG, analyses…) attachées à des solutions techniques modulaires, variabilisées, réutilisables, testées unitairement
3. **HermesInstances** *(à venir)* — l'écurie : fabrication/configuration des agents métier par client avant création/update

## 🎯 Principe

Une **capability** = une compétence métier granulaire (ex : « lire une boîte Gmail », « OCR des pièces jointes », « indexer dans le RAG Supabase ») décrite par un **contrat déclaratif** (`manifest.yaml`). Le client n'active que les capabilities dont il a besoin : `capability-attach.sh arev rag-supabase email-gmail` configure l'instance (MCP, skills, routines, secrets, SOUL.md) — **la flotte part avec ses compétences à l'instanciation ou à l'update**.

## 🔁 Cycle de vie d'une capability

```
1. ÉTUDE      → decision.md : disponibilité NATIF > MIX > SIDECAR (re-vérifiée à chaque montée de version Hermes)
2. CONTRAT    → manifest.yaml : secrets, env variabilisé, MCP, skills, routines, soul_addendum
3. IMPLÉMENT  → skill.md, mcp.json, routine.yaml (selon le type retenu)
4. TESTER     → tests/test.sh via scripts/capability-test.sh (local d'abord, VPS ensuite)
5. ATTACHER   → scripts/capability-attach.sh <slug> <capability> (--dry-run d'abord)
6. INTÉGRER   → HermesConfig v3 consommera les manifests à l'instanciation (integration-hermesconfig.md)
```

## 📂 Structure

```
HermesCapabilities/
├── README.md                      ← Ce fichier
├── ARCHITECTURE.md                ← Contrat de capability + matrice de disponibilité + sécurité
├── capabilities/
│   ├── TEMPLATE/                  ← Squelette d'une nouvelle capability (à copier)
│   └── rag-supabase/              ← C5 — pilote : RAG Supabase pgvector via MCP (natif)
├── pipelines/
│   └── TEMPLATE/pipeline.yaml     ← Composition de capabilities (chaîne métier)
├── scripts/
│   ├── capability-test.sh         ← Runner des tests unitaires
│   └── capability-attach.sh       ← Attache des capabilities à un client (VPS, --dry-run)
└── integration-hermesconfig.md    ← Contrat d'interface avec HermesConfig (spawn v3)
```

## 🚀 Quickstart

```bash
# Vérifier le contrat de toutes les capabilities (local, read-only)
./scripts/capability-test.sh all

# Nouvelle capability : copier le TEMPLATE, remplir manifest + decision
cp -r capabilities/TEMPLATE capabilities/ma-capability
$EDITOR capabilities/ma-capability/manifest.yaml capabilities/ma-capability/decision.md
./scripts/capability-test.sh ma-capability

# Sur le VPS — attacher à un client (jamais sans --dry-run la première fois)
sudo ./scripts/capability-attach.sh arev rag-supabase --dry-run
sudo ./scripts/capability-attach.sh arev rag-supabase
```

## 🔗 Références

- Architecture & contrats : [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Interface avec HermesConfig : [`integration-hermesconfig.md`](integration-hermesconfig.md)
- Veille Hermes (Bot Mode, MCP, OCR) : [`../HermesConfig/VEILLE_HERMES_2026-08.md`](../HermesConfig/VEILLE_HERMES_2026-08.md)
- Vault : `/home/syncthing/obsidian-vault/VPS/HermesCapabilities/`
