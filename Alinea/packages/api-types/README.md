# @alinea/api-types — GENERATED artifacts

Everything living in `src/generated/` is generated — **never edit by hand**.

| File | Generator | Source |
|---|---|---|
| `schema.d.ts` | `pnpm gen:api-types` (openapi-typescript) | `openapi/openapi.yaml` (itself generated from the SQL) |
| `database.types.ts` | `pnpm gen:db-types` (Supabase CLI, linked project) | Live schema of the Supabase project (= `sql/generic/`) |

Full regeneration: `pnpm gen-all` (from `Alinea/`).
Drift check (CI): `pnpm gen:check`.

Consumption:

```ts
import type { paths, components } from "@alinea/api-types/schema";
type Facture = components["schemas"]["Facture"];
```
