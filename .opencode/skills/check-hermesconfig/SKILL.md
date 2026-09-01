---
name: check-hermesconfig
description: >-
  Vérification de non-régression du projet VPS et des sous-projets HermesConfig
  + HermesCapabilities (agents Hermes pro clients PME). Use when the user says
  "check", "vérification", "non-régression", "audit projet", "check
  HermesConfig", "audit-hermes-pro", at the start of a session on this repo,
  before any commit touching HermesConfig/ or HermesCapabilities/, or after
  any VPS deployment. Local git/template invariants + read-only SSH fleet
  checks + capability contract tests.
---

# Check non-régression HermesConfig

Exécuter les commandes exactes ci-dessous depuis la racine du repo
(`/home/redouane/dev/VPS`). Regles absolues :

1. NE JAMAIS corriger automatiquement un FAIL — rapporter et proposer.
2. NE JAMAIS afficher une valeur de secret (compter les valeurs non vides
   avec `grep -c`, vérifier la présence avec `test -n`).
3. Registre de référence : `HermesConfig/VERIFICATIONS.md` (invariants I1-I15,
   leçons datées). Le consulter si un check échoue pour comprendre le pourquoi.
4. SSH indisponible (`ssh -o BatchMode=yes -o ConnectTimeout=8 nemo 'echo ok'`
   échoue) → sections B = `⏭ SKIP` (jamais bloquant). Sections A et C restent
   exécutées.
5. Sortie : tableau `| Check | PASS / FAIL / WARN / SKIP | Détail |` puis
   actions correctives **proposées** (sans exécution sans validation
   utilisateur). Verdict global : SAIN / ACTION REQUISE.

## A. Local (toujours)

A1. Secrets dans les fichiers versionnés (attendu : vide) :

    git ls-files | xargs grep -lEn '(sk-[A-Za-z0-9]{10,}|[0-9]{6,12}:AA[A-Za-z0-9_-]{30,}|ghp_[A-Za-z0-9]{20,}|AIza[A-Za-z0-9_-]{30,})'

A2. Fichiers sensibles versionnés (attendu : vide) :

    git ls-files | grep -E '\.(env|key|pem)$|\.tar\.gz$|Zone\.Identifier'

A3. `.gitignore` couvre `*.env` : `grep -q '^\*\.env$' .gitignore`

A4. Fichiers requis présents (`test -f`, 17 fichiers) :
    `HermesConfig/README.md`, `HermesConfig/VEILLE_HERMES_2026-08.md`,
    `HermesConfig/ARCHITECTURE.md`, `HermesConfig/DEPLOYMENT.md`,
    `HermesConfig/docker/docker-compose.yml.template`,
    `HermesConfig/hermes/config.yaml.example`,
    `HermesConfig/hermes/bots/README.md`,
    `HermesConfig/hermes/bots/ops-bot.example.md`,
    `HermesConfig/hermes/routines/README.md`,
    `HermesConfig/hermes/skills/README.md`,
    `HermesConfig/clients/TEMPLATE/client.env.example`,
    `HermesConfig/clients/TEMPLATE/soul.md`,
    `HermesConfig/clients/arev/client.env.example`,
    `HermesConfig/clients/arev/soul.md`,
    `HermesConfig/scripts/spawn-hermes-pro.sh`,
    `HermesConfig/scripts/audit-hermes-pro.sh`,
    `HermesConfig/VERIFICATIONS.md`

A5. Invariants du template (`T=HermesConfig/docker/docker-compose.yml.template`) :

    I1  : grep -E '^\s*-\s*TELEGRAM_FALLBACK_IPS=' "$T"   → attendu VIDE
          (le commentaire d'interdiction ligne ~30 est légitime)
    I2  : grep -q '127\.0\.0\.1:__PORT__' "$T"
    I3  : grep -q '__IMAGE__' "$T" ; grep -c 'latest' "$T" → 0
    I4  : grep -q 'secrets\.env' "$T" ; et AUCUNE ligne
          'TELEGRAM_BOT_TOKEN=' ou '_API_KEY=' dans la section environment:
    I5  : grep -q 'cap_drop' "$T" ; grep -q 'no-new-privileges:true' "$T"
    I6  : grep -q 'HERMES_UID=10000' "$T"
    I7  : grep -q '__VAULT_CLIENT_DIR__:/opt/vault' "$T"
    I8  : grep -q 'gateway_state\.json' "$T" ;
          grep -c '/dev/tcp/127\.0\.0\.1/8642' "$T" → 0
    I10 : grep -q 'mem_limit' "$T" ; grep -q 'cpus' "$T"

A6. `HermesConfig/hermes/config.yaml.example` : `grep -q 'redact_secrets: true'`

A7. Scripts (`S=HermesConfig/scripts/spawn-hermes-pro.sh`) :
    - `bash -n HermesConfig/scripts/spawn-hermes-pro.sh` et
      `bash -n HermesConfig/scripts/audit-hermes-pro.sh`
    - `test -x` sur les deux
    - Ancrages dans $S (grep -q, chacun doit passer) : 'umask 077',
      '/etc/secrets/hermes.env', 'Port existant conservé',
      'docker exec "hermes-$SLUG-pro" grep -qs', 'INHERITED_DEEPSEEK_KEY'
    - Garde-fou anti-fuite présent dans les 2 scripts :
      grep -q 'sk-\[A-Za-z0-9\]' <script>

A8. `HermesConfig/clients/*/client.env.example` :
    `grep -E 'TELEGRAM_BOT_TOKEN=.'` → vide (token vide) ;
    aucun token réel (pattern `[0-9]{6,12}:AA`)

A9. `HermesConfig/clients/*/soul.md` : contient sait / peut / refuse / escalade

A10. Sous-projet HermesCapabilities (volet 2 — compétences modulaires) :

     Fichiers requis (`test -f`) :
     `HermesCapabilities/README.md`, `HermesCapabilities/ARCHITECTURE.md`,
     `HermesCapabilities/DECISIONS.md`,
     `HermesCapabilities/PIPELINE_EMAIL_AREV.md`,
     `HermesCapabilities/integration-hermesconfig.md`,
     `HermesCapabilities/pipelines/TEMPLATE/pipeline.yaml`,
     `HermesCapabilities/sql/README.md`,
     `HermesCapabilities/sql/generic/001_schema.sql`,
     `HermesCapabilities/sql/generic/002_clients.sql`,
     `HermesCapabilities/sql/arev/001_rpc.sql`,
     `HermesCapabilities/scripts/supabase-sql.sh`,
     `HermesCapabilities/capabilities/TEMPLATE/manifest.yaml`,
     `HermesCapabilities/capabilities/TEMPLATE/decision.md`,
     `HermesCapabilities/capabilities/TEMPLATE/soul-addendum.md`,
     `HermesCapabilities/capabilities/TEMPLATE/tests/test.sh`,
     `HermesCapabilities/capabilities/rag-supabase/manifest.yaml`,
     `HermesCapabilities/capabilities/rag-supabase/decision.md`,
     `HermesCapabilities/capabilities/rag-supabase/soul-addendum.md`,
     `HermesCapabilities/capabilities/rag-supabase/skill.md`,
     `HermesCapabilities/capabilities/rag-supabase/mcp.json`,
     `HermesCapabilities/capabilities/rag-supabase/tests/test.sh`

     Tests de contrat (attendu : 0 FAIL, tout PASS) :

     HermesCapabilities/scripts/capability-test.sh all

     Scripts : `bash -n` + `test -x` sur `capability-test.sh` et
     `capability-attach.sh`. `decision.md` de chaque capability contient un
     verdict natif/mix/sidecar (couvert par les tests de contrat).

## B. VPS (read-only — SKIP si SSH indisponible)

Préfixe : `ssh -o BatchMode=yes -o ConnectTimeout=8 nemo`

B1. Audit flotte (attendu : 0 FAIL) :

    ssh -o BatchMode=yes nemo 'cd /home/admin/hermes-fleet/HermesConfig && sudo ./scripts/audit-hermes-pro.sh'

B2. Invariants I1/I4 en conditions réelles :

    ssh -o BatchMode=yes nemo 'sudo grep -lE "^\s*-\s*TELEGRAM_FALLBACK_IPS=" /home/admin/hermes-fleet/HermesConfig/instances/*/docker-compose.yml'
    → attendu vide ; et chaque compose référence secrets.env

B3. Par instance (`instances/*/`) : conteneur `running`, healthcheck `healthy`,
    `gateway_state.json` contient `"state":"connected"`, port lié `127.0.0.1`,
    image non-`latest`, `RestartPolicy=unless-stopped`, LogConfig max-size
    `10m`, Memory > 0 ; et le tag d'image existe localement
    (`docker images` contient le tag exact utilisé).
    (B1 couvre l'essentiel — ne refaire les détails qu'en cas de doute.)

B4. Secrets : `instances/*/secrets.env` et `clients/*/client.env` en 600 ;
    `TELEGRAM_ALLOWED_USERS` et `DEEPSEEK_API_KEY` non vides — vérifier par
    comptage (`grep -c 'VAR=.'`), JAMAIS en affichant les valeurs.

B5. `instances/*/data` : `config.yaml` contient `redact_secrets: true`,
    `SOUL.md` présent, data-dir en `10000:10000` / `700`.

B6. Vault : `sudo getfacl /home/syncthing/obsidian-vault/VPS/HermesConfig/<slug>`
    → `user:syncthing:rwx` + `default:user:syncthing:rwx` ; les 4 notes
    présentes dans `/home/syncthing/obsidian-vault/VPS/HermesConfig/`
    (VEILLE, Décisions, Runbook AREV, État flotte pro) ; sous-dossier `arev/`.
    ⚠️ Lister avec `sudo ls` (dossier appartient à syncthing — un `ls` simple
    en admin échoue en Permission denied).

B7. Drift repo↔VPS (I14) : comparer md5sum locaux vs VPS sur
    `scripts/spawn-hermes-pro.sh`, `scripts/audit-hermes-pro.sh`,
    `docker/docker-compose.yml.template`, `VERIFICATIONS.md` :

    md5sum HermesConfig/scripts/*.sh HermesConfig/docker/docker-compose.yml.template HermesConfig/VERIFICATIONS.md
    ssh -o BatchMode=yes nemo 'sudo md5sum /home/admin/hermes-fleet/HermesConfig/scripts/*.sh /home/admin/hermes-fleet/HermesConfig/docker/docker-compose.yml.template /home/admin/hermes-fleet/HermesConfig/VERIFICATIONS.md'

    → les hashes doivent être IDENTIQUES. Un écart = édition directe sur le
    VPS non reportée dans git (ou rsync oublié) → FAIL + proposer resync.

B8. Transition : `ssh nemo 'systemctl is-active hermes-gateway-arev'` = active
    OU cutover documenté dans la note « État flotte pro.md » du vault.

## C. Cohérence (local)

- `README.md` racine mentionne `HermesConfig` **et** `HermesCapabilities` (grep)
- `Installation/DOCUMENTATION_VPS.md` contient `4.5bis` (grep)
- `HermesConfig/VERIFICATIONS.md` existe
- `HermesConfig/README.md` référence le volet 2 `HermesCapabilities` (grep)
- `git status -sb` : arbre propre (ou modifications assumées) ; note le
  nombre de commits d'avance sur `origin/main`

## D. Observation — autres sessions (WARN informatif, JAMAIS FAIL)

`ssh nemo` (read-only) : `sudo ufw status` contient deny 8642 et 8650-8653 +
allow 2222 ; `sudo fail2ban-client status sshd` actif ; `grep pam_exec
/etc/pam.d/sshd` présent ; flotte v1 visible (`docker ps` : 4 conteneurs
hermes-* non `-pro`, 2 runners natifs actifs).
Ces éléments appartiennent à d'autres sessions — toute anomalie = WARN.

## Sortie imposée

Tableau : `| Check | PASS / FAIL / SKIP | Détail |` puis actions correctives
proposées (sans exécution sans validation utilisateur). Sections VPS
indisponibles = SKIP. Conclure par un verdict global : SAIN / ACTION REQUISE.

## Remédiation (en cas de FAIL)

Toujours partir du registre `HermesConfig/VERIFICATIONS.md` (invariants
I1-I15 + leçons datées) ; côté VPS : `HermesConfig/DEPLOYMENT.md` ;
compléments généraux : `Installation/DOCUMENTATION_VPS.md` §4.5bis.

## Étendre (quand le projet avance)

- Nouveau client → RIEN à faire : B1/B3 itèrent sur `instances/*/`.
- Nouvelle capability HermesCapabilities → mettre à jour la liste A10
  (nouveaux fichiers requis) ; le runner `capability-test.sh all` couvre
  automatiquement les contrats.
- Nouvel invariant (nouvelle leçon) → 1) ce SKILL.md, 2)
  `HermesConfig/VERIFICATIONS.md` (+ date et leçon), 3) `audit-hermes-pro.sh`
  si côté VPS. Committer les trois ensemble.
- Cutover AREV (arrêt du runner natif) → mettre à jour B8 ici et la note
  « État flotte pro.md ».
