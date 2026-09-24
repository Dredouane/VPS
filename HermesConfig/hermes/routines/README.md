# ⏰ Routines (cron Hermes) — HermesConfig

Les **routines** sont des responsabilités récurrentes qui appartiennent à un
bot (règle : pas de routine sur l'agent principal sans raison — voir
`../bots/README.md`). Outil headless : `hermes cron` (fonctionne dans le
conteneur, pas besoin du Desktop).

## Commandes utiles (dans le conteneur)

```bash
docker exec -it hermes-<slug>-pro bash
hermes cron list                     # jobs existants
hermes cron create --profile ops "0 7 * * 1" "Tâche…"   # création
hermes cron run <id>                 # exécution au prochain tick
hermes cron pause / resume <id>
hermes cron history                  # historique d'exécution
hermes cron incidents                # incidents
```

## Catalogue de routines recommandées (client PME)

| Routine | Fréquence | Bot | Objectif |
|---|---|---|---|
| Rapport hebdo | lun 07:00 | Ops | Synthèse de la semaine → Telegram + vault |
| Check vault | quotidien 06:30 | Ops | Écriture OK + espace data-dir |
| Rappel échéances | quotidien 08:00 | Principal* | Devis/factures arrivant à échéance (lecture vault) |
| Surveillance crons | quotidien 09:00 | Ops (ou « Cronfather ») | Vérifier les autres crons, escalader les échecs |

\* exception acceptée si la routine est purement « lecture + message ».

## Règles

1. **Jamais de secret en clair** dans une routine (passer par env/config).
2. Chaque routine est **relue par le prestataire** avant activation.
3. Chaque routine est **documentée dans le vault client** (nom, fréquence,
   sortie attendue, quoi faire si échec).
4. Une routine qui échoue **2 fois** → escalade humaine (voir
   `../bots/ops-bot.example.md`).
5. Après redéploiement du conteneur : vérifier `hermes cron list` (l'état des
   jobs vit dans le data-dir persistant `/opt/data`, donc survit au restart —
   à vérifier après un `down -v` qui détruirait tout).
