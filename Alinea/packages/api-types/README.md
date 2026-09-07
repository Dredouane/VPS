# @alinea/api-types — artefacts GÉNÉRÉS

Tout ce qui vit dans `src/generated/` est généré — **ne jamais éditer à la main**.

| Fichier | Générateur | Source |
|---|---|---|
| `schema.d.ts` | `pnpm gen:api-types` (openapi-typescript) | `openapi/openapi.yaml` (lui-même généré depuis le SQL) |
| `database.types.ts` | `pnpm gen:db-types` (CLI Supabase, projet lié) | Schéma live du projet Supabase (= `sql/generic/`) |

Régénération complète : `pnpm gen-all` (depuis `Alinea/`).
Vérif de désynchronisation (CI) : `pnpm gen:check`.

Consommation :

```ts
import type { paths, components } from "@alinea/api-types/schema";
type Facture = components["schemas"]["Facture"];
```
