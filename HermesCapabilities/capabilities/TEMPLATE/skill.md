---
name: template-skill
description: >-
  Skill TEMPLATE HermesCapabilities — remplacer par la description réelle.
  Frontmatter attendu par Hermes (valider le format exact avec
  `hermes skills list` sur une instance avant activation — M2).
---

# Skill TEMPLATE

> ⚠️ **Note d'implémentation** : l'emplacement exact des skills custom dans
> une instance dockerisée (`/opt/data/skills/<name>/SKILL.md` ?) reste à
> valider en M2 (`hermes skills --help`, essai sur l'instance test). Le
> `capability-attach.sh` copie ce fichier vers `data/skills/<id>/SKILL.md`
> comme best-effort et le signale en warning.

## Rôle

Décrire ce que la skill permet à l'agent de faire, en termes métier.

## Quand l'utiliser

Décrire les déclencheurs (demande utilisateur, routine, pipeline).

## Périmètre et limites

- Outils utilisés : (MCP, API, fichiers — référencer le manifest)
- Jamais : rappeler les refus pertinents (le détail vit dans le soul-addendum)

## Sortie attendue

Décrire le format de sortie (message Telegram, note vault, ligne RPC…).
