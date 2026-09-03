# Decision — Capability analysis-facturation (C6)

> Règle d'ordre : **NATIF > MIX > SIDECAR** (ARCHITECTURE.md §2).

## Besoin

Extraire tout le contexte de facturation d'un email (mail + facture OCR
pré-vérifiée), matcher/créer/mettre à jour la donnée structurée SQL dans
Supabase pour la webApp CRUD et les autres agents (exigence 01/09).

## Options évaluées

| Option | Verdict |
|---|---|
| **Natif** : skills (router + expert) sur RPC génériques C5 — zéro code custom, la structure d'extraction vient de C3 | ✅ **retenu** |
| Sidecar service facturation | ❌ sur-ingénierie, les RPC + skills suffisent |
| LLM avec accès SQL direct | ❌ viole D8 (RPC only) |

## Décision

**Natif** — pattern **Chain of Experts** (D2) : `expert-router` (décision de
routage en JSON strict) + `expert-facturation` (assemblage + matching +
upsert via `rpc_cap_facture_upsert`). Les nombres sont **déjà vérifiés**
par le check montant C3 — l'expert ne fait pas d'arithmétique. Règles
strictes : numero requis, statuts humains protégés (D6), jamais de SQL
direct.

## Re-vérification

| Date | Hermes | Verdict inchangé ? | Notes |
|---|---|---|---|
| 2026-09-01 | v0.20.6 | — (décision initiale) | RPC génériques smoke OK |
