---
name: vps-check-repo
description: >-
  Checks locaux stricts de non-régression du repo git VPS (aucun SSH requis) :
  secrets versionnés, fichiers sensibles trackés, couverture .gitignore,
  visibilité du repo, config SSH locale (Host nemo), alias ~/.bashrc.
  Use when the user says "check repo", "vps-check-repo", "hygiène du dépôt",
  "secrets versionnés", "vérifier le repo git", at the start of a session on
  this repo, or as part of vps-check-full.
---

# Check repo — hygiène git locale (READ-ONLY, sans SSH)

Skill **100 % locale**, exécuter depuis la racine du repo `/home/redouane/dev/VPS`.
Règles absolues :

1. **READ-ONLY strict** : aucune modification du dépôt (interdits : `git add`,
   `git commit`, `git checkout`, `git clean`, `git stash`, création/suppression
   de fichiers, `sed -i`). Le skill rapporte, il ne corrige jamais.
2. **Aucun secret affiché** : si un pattern de secret matche, afficher
   uniquement le chemin du fichier + le numéro de ligne, **jamais la valeur**
   (tronquer à 40 caractères maximum).
3. Sortie : tableau `| Check | Statut | Détail |` avec statuts `✓ PASS`,
   `✗ FAIL`, `~ WARN`, `⏭ SKIP` + verdict global (SAIN / ACTION REQUISE).
4. En cas de FAIL : orienter vers la remédiation (§Remédiation), ne rien appliquer.

## Checks

R1 à R3 : `git grep` retourne rc=1 quand aucune correspondance → **rc=1 = PASS**.

| # | Check | Commande | Attendu |
|---|---|---|---|
| R1 | Secrets dans les fichiers trackés | `git grep -nE 'sk-[A-Za-z0-9]{10,}\|ghp_[A-Za-z0-9]{20,}\|[0-9]{6,12}:AA[A-Za-z0-9_-]{30,}\|AIza[A-Za-z0-9_-]{30,}\|Bearer [A-Za-z0-9_-]{20,}'` | 0 correspondance |
| R2 | Fichiers sensibles trackés | `git ls-files \| grep -E '\.(env\|key\|pem)$\|\.tar\.gz$\|Zone\.Identifier'` | vide (les `.env.example` sont tolérés) |
| R3 | `spawn-agent.sh` (ancien script, lien invalide) non versionné | `git ls-files \| grep spawn-agent` | vide |
| R4 | `backup.tar.gz` ignoré | `git check-ignore Installation/backup.tar.gz` | retourne le chemin (rc=0) |
| R5 | `*.env` ignorés | `git check-ignore 'HermesConfig/clients/arev/client.env'` | rc=0 |
| R6 | Artefacts `Zone.Identifier` ignorés | `git check-ignore 'Installation/VPS_HARDENING_PLAN_FINAL.md:Zone.Identifier'` | rc=0 |
| R7 | Repo GitHub PRIVÉ | `gh repo view Dredouane/VPS --json visibility -q .visibility` | `PRIVATE` — si `gh` absent/non authentifié → `~ WARN` (ne pas FAIL) |
| R8 | Config SSH locale `Host nemo` | `grep -A5 '^Host nemo$' ~/.ssh/config` | contient `User admin`, `Port 2222`, `IdentityFile ~/.ssh/REDACTED` |
| R9 | Alias `syncthing-gui` (tunnel GUI Syncthing) | `grep syncthing-gui ~/.bashrc` | présent (ligne active) |
| R10 | Ancien alias root@22 neutralisé | `grep -n 'alias nemo' ~/.bashrc` | ancien alias `root@…:22` **commenté** (précédé de `#`) ; seul l'alias SSH `nemo` → admin@2222 est actif (dans `~/.ssh/config`) |
| R11 | État de l'arbre (informatif) | `git status -sb` | noter branche, fichiers modifiés, avance sur `origin/main` — jamais FAIL |
| R12 | Clés privées locales jamais versionnées | `git ls-files \| grep -cE 'id_vps_backup\|REDACTED\|id_ed25519'` → **0** ; `ls ~/.ssh/id_vps_backup` présent localement (info — la clé backup pull n'existe que sur le PC) | 0 clé privée trackée ; la clé publique seule, si versionnée un jour, est tolérée |

## Rapport

1. Exécuter chaque commande, noter le statut.
2. Tableau final `| Check | Statut | Détail |` : pour R1/R2, indiquer
   `0 correspondance` ; pour un échec, lister fichier:ligne **sans la valeur**.
3. Verdict global : **SAIN** si 0 FAIL, sinon **ACTION REQUISE**.
4. Rappel : signaler les régressions, ne rien corriger.

## Remédiation (en cas de FAIL)

| Check | Référence |
|---|---|
| R1-R3 (secrets/sensibles trackés) | `README.md` racine (avertissement repo privé) + `Installation/RAPPORT_AUDIT_2026-08-30.md` §5.5 (procédure de purge d'historique si déjà commité) |
| R4-R6 (.gitignore) | `.gitignore` racine (blocs backup / Zone.Identifier / secrets) |
| R8-R10 (SSH/alias) | `Installation/DOCUMENTATION_VPS.md` §1 (Accès SSH, alias configurés) |
| R7 (visibilité) | GitHub → Settings → Danger Zone (manuel) |
