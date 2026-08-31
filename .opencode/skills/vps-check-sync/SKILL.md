---
name: vps-check-sync
description: >-
  Non-régression Syncthing & vault Obsidian sur le VPS nemo (SSH read-only) :
  service syncthing@syncthing actif, folder obsidian-vault en état idle,
  GUI bindé sur 127.0.0.1:8384, sous-dossier projet VPS/HermesConfig,
  connexions devices, relais, port 22000. Use when the user says "check
  sync", "vps-check-sync", "Syncthing", "vault Obsidian", "synchronisation",
  "état du sync", or as part of vps-check-full.
---

# Check sync — Syncthing & vault Obsidian (SSH read-only)

Audit **lecture seule** de Syncthing sur `nemo` (admin@REDACTED:2222,
clé `REDACTED`), baseline = `Installation/SYNCTHING_OBSIDIAN.md`.
Règles absolues :

1. **READ-ONLY strict** : interdits côté serveur — `systemctl restart`,
   `syncthing` (CLI), `rm`, `sed -i`, toute écriture de config. Le skill
   rapporte, il ne corrige jamais.
2. **Aucun secret affiché** : l'**apikey GUI** (lue dans `config.xml`) et les
   **device IDs complets** ne doivent JAMAIS apparaître dans la sortie ni
   dans une commande echoée — les extraire dans une variable côté serveur,
   afficher seulement les états (`idle`, `needFiles`, compteurs) et des
   préfixes masqués (`GPMPYZ2-…`, `67QMEVF-…`).
3. Sortie : tableau `| Check | Statut | Détail |` avec `✓ PASS` / `✗ FAIL` /
   `~ WARN` / `⏭ SKIP` + verdict global (SAIN / ACTION REQUISE).
4. FAIL → orienter vers la remédiation (§Remédiation), ne rien appliquer.

## Connexion

```bash
SSH="ssh -o BatchMode=yes -o ConnectTimeout=8 nemo"
```

Sonde préalable : `$SSH 'echo ok'` → si échec : **tous les checks Y1-Y8 =
SKIP**, conclure avec la note « VPS non joignable — checks distants ignorés ».
Le check Y9 est local (exécutable quoi qu'il arrive).

## Checks

| # | Check | Commande (`$SSH '…'`) | Attendu |
|---|---|---|---|
| Y1 | Service actif + activé | `systemctl is-active syncthing@syncthing` + `systemctl is-enabled syncthing@syncthing` | `active` + `enabled` |
| Y2 | Folder `obsidian-vault` | `APIKEY=$(sudo grep -oP '(?<=<apikey>)[^<]+' /home/syncthing/.config/syncthing/config.xml); curl -s -H "X-API-Key: $APIKEY" 'http://127.0.0.1:8384/rest/db/status?folder=obsidian-vault' \| grep -oE '"(state\|needFiles\|needBytes)":[^,}]*'` | `state: idle`, `needFiles: 0` |
| Y3 | Devices | `curl … /rest/system/connections` → lister `id[:7]-…` + `connected=` (python, IDs masqués) | 4 devices déclarés : PC (`GPMPYZ2-…`) connecté + un 2ᵉ device actif (`6QXB532-…`) ; Android (`67QMEVF-…`) et `REDACTED_DEVICE_ID…` offline = `~ WARN` (mobile pas toujours allumé) |
| Y4 | GUI local uniquement | `sudo grep -A3 '<gui' /home/syncthing/.config/syncthing/config.xml \| grep -oE '<address>[^<]+</address>'` | `127.0.0.1:8384` — **FAIL si `0.0.0.0`** |
| Y5 | Relais activé | `sudo grep -oE '<relaysEnabled>[a-z]*</relaysEnabled>' /home/syncthing/.config/syncthing/config.xml` | `<relaysEnabled>true</relaysEnabled>` (nomades via relay) |
| Y6 | Sous-dossier projet | `sudo stat -c '%U:%G %a' /home/syncthing/obsidian-vault/VPS` (sudo obligatoire) | existe, owner `syncthing:syncthing` |
| Y7 | Vault HermesConfig | `ls /home/syncthing/obsidian-vault/VPS/HermesConfig/` | notes présentes (VEILLE, Décisions, Runbook AREV, État flotte pro) + sous-dossier `arev/` |
| Y8 | Port données 22000 | `sudo ss -tlnp \| grep syncthing` | `*:22000` en écoute (filtré par UFW — cf. skill `vps-check-securite` S14) |
| Y9 | Tunnel GUI (local) | `grep syncthing-gui ~/.bashrc` (machine locale) | alias présent — cf. skill `vps-check-repo` R9 |

⚠️ Y2/Y3 : ne jamais `echo $APIKEY` ni logger la commande avec la clé ;
exécuter l'extraction et le curl **dans la même session SSH**.

## Rapport

1. Tableau final `| Check | Statut | Détail |` (états Synccthing, GUI/sécurité,
   vault).
2. En cas de `state` ≠ `idle` (ex. `scanning`, `syncing`) : `~ WARN` si
   transitoire (re-vérifier une fois), FAIL si persistant + needFiles > 0.
3. Verdict global : **SAIN** si 0 FAIL, sinon **ACTION REQUISE**.
4. Rappel : signaler les régressions, ne rien corriger.

## Remédiation (en cas de FAIL)

| Check | Référence |
|---|---|
| Y1 (service) | `Installation/SYNCTHING_OBSIDIAN.md` §3.1 (Service) + §4.2 (Redémarrer Syncthing) |
| Y2-Y3 (folder/devices) | `Installation/SYNCTHING_OBSIDIAN.md` §4.4 (Diagnostics rapides) + §5 (Dépannage : Android non connecté, IP WSL changeante, conflits) |
| Y4-Y5 (GUI/relais) | `Installation/SYNCTHING_OBSIDIAN.md` §7 (Rappels sécurité) + §3.3 (Relais) |
| Y6-Y7 (vault) | `Installation/SYNCTHING_OBSIDIAN.md` §1.2 (Folder partagé) + `Installation/DOCUMENTATION_VPS.md` §4.6 (Vault Obsidian & Syncthing) |
| Y8 (port 22000) | `Installation/SYNCTHING_OBSIDIAN.md` §3.2 (Pare-feu UFW) + §3.4 (Ports d'écoute) |
| Y9 (alias) | `Installation/DOCUMENTATION_VPS.md` §1 (Accès SSH) |
