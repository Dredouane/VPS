# 🧩 Skills — HermesConfig

Hermes dispose d'un **learning loop** : il crée et améliore ses propres skills
au fil des tâches. Pour un client pro, on **laisse le loop actif** mais on
l'encadre.

## Principes

1. **Skills auto-créées** : stockées dans le data-dir persistant
   (`/opt/data`) → survivent aux restarts. Lister régulièrement et relire :
   ```bash
   docker exec -it hermes-<slug>-pro hermes skills list
   ```
2. **Skills custom client** (démarrage à froid) : à définir dans le vault client
   (`VPS/HermesConfig/<slug>/Skills.md`) — nom, déclencheur, périmètre, sorties.
   Exemples PME travaux : `compte-rendu-chantier`, `relance-facture`,
   `resume-devis`.
3. **Périmètre** : une skill ne peut jamais élargir les refus du `SOUL.md`.
   Tout ce qui touche réseau sortant, fichiers hors `/opt/vault` + `/opt/data`,
   ou secrets est **refusé par défaut**.
4. **Relire après montée de version** de l'image : les skills internes bundlées
   évoluent avec Hermes (`hermes skills` affiche les user-modifiées).

## Intégrations optionnelles (activer seulement si besoin client)

| Intégration | Usage | Note |
|---|---|---|
| **Firecrawl** | OCR des documents scannés (factures papier, PV) | Cas PME travaux : probable — clé API à stocker dans `client.env`, jamais en clair |
| **MCP** | Outils externes supplémentaires | Un serveur MCP = une surface d'attaque : qualification prestataire avant activation |
| **Bitwarden/1Password** | Secrets externes (`hermes secrets`) | Alternative à `client.env` si le client a un coffre |

> Toute activation est une décision documentée dans le vault
> (`Décisions HermesConfig.md`) et testée en recette avant prod.
