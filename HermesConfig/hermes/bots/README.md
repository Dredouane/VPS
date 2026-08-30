# 🤖 Bot Mode — Règles et rôles (HermesConfig)

## Ce que c'est

Un **Bot** = un vrai profile Hermes (`~/.hermes/profiles/<name>/` en natif,
équivalent dans `HERMES_HOME` en Docker) avec : `SOUL.md` propre, **mémoire
isolée**, modèle, skills, tools, MCP, sessions et **routines (cron)**.

⚠️ **Bot Mode est d'abord une UX Desktop** (roster, @mentions, group chats 2-6
bots, tours sérialisés) — mais **les profiles fonctionnent très bien en
headless Docker** : les routines cron s'attachent aux profiles côté serveur
(`hermes cron …` dans le conteneur), et l'orchestration peut passer par le
kanban/peer. L'interface Desktop n'est requise que pour la supervision visuelle
des group chats.

## Règle de décision Bot vs Subagent

| Critère | Subagent | Bot |
|---|---|---|
| Tâche ponctuelle | ✅ | ❌ |
| Rôle récurrent | ❌ | ✅ |
| Mémoire/historique propres | ❌ | ✅ |
| Modèle/skills/tools spécialisés | ❌ | ✅ |
| Appelable par rôle par d'autres bots | ❌ | ✅ |
| Travail récurrent (cron) | ❌ | ✅ |

**Maximum 2-4 bots par client.** Ne pas multiplier : chaque bot = une
responsabilité stable. Exemple « The Cronfather » (veille §3.1) : un bot qui
surveille les crons des autres et escalade à l'humain — pertinent quand le
nombre de routines grandit.

## Rôles recommandés pour un client PME (ordre de création)

1. **Principal** (l'agent du client, spawné par `spawn-hermes-pro.sh`) —
   interface Telegram, travail quotidien. *Pas un bot séparé : c'est le
   profile par défaut du conteneur.*
2. **Ops** — surveillance, routines cron (backup check, monitoring, rappels),
   escalade. Voir `ops-bot.example.md`.
3. *(optionnel)* **Researcher** — veilles web multi-sources, OCR documents
   (Firecrawl), résumés documentaires.
4. *(optionnel)* **Content/Admin** — rédaction de comptes-rendus, relances,
   documents administratifs récurrents.

## Création en headless (dans le conteneur)

```bash
docker exec -it hermes-<slug>-pro bash   # ou docker compose exec
hermes profile create ops
# éditer le SOUL.md du profile, puis attacher une routine :
hermes cron create --profile ops "0 7 * * 1" "Rapport hebdo : résumé de la semaine dans /opt/vault"
hermes cron list
```

Chaque bot/routine créée doit être **documentée dans le vault client**
(`VPS/HermesConfig/<slug>/Bots et routines.md`) : nom, rôle, routine, ce
qu'il sait/peut/refuse.

## Non négociable

- Le bot Ops ne touche pas au périmètre des autres clients (même isolation).
- Les routines ne contiennent **jamais** de secrets en clair (passer par env/config).
- Toute nouvelle routine est relue par le prestataire avant activation.
