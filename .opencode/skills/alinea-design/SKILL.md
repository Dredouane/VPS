---
name: alinea-design
description: Design guide for the Alinea webapp (Next.js + shadcn + Tailwind v4) — tokens, page shells, states, tables, status badges, responsive. Use when the user says "design pass", "revoir le design", "alinea-design", "design system", or when creating/modifying pages or components in Alinea — to keep the UI sober, consistent and reviewable without breaking it.
---

# 🎨 alinea-design — Alinea design system

Style: **sober, professional, dense**. SME client backoffice (desktop first,
mobile supported). Never overload: colors = tokens only,
no gradients, no strong shadows.

## 1. Where things live (golden rule)

| Type | Location | Example |
|---|---|---|
| Tokens + generic primitives | `Alinea/packages/ui` | button, card, badge, page-header, empty-state, skeleton |
| Neutral business components | `packages/ui` (map state → variant) | statut-facture-badge |
| Page logic + TanStack queries | `Alinea/apps/web/src/app/(app)/*` | dashboard, factures, chains |

A visual redesign = modify `packages/ui` (tokens + primitives) —
the pages don't change. Conversely: a page NEVER contains custom
colors/sizes outside tokens (`text-muted-foreground`, `bg-accent`…).

## 2. Mandatory page shells

- Every main page starts with `<PageHeader title description actions?>`
  (title `text-2xl font-semibold tracking-tight`, description `text-sm muted`).
- Secondary filters/actions go in `actions` (buttons `size="sm"`).
- Main content in a `<Card className="py-0">` + `<CardContent className="px-0">`
  for tables (borders along the card edges, padding handled by cells).

## 3. States (TANStack Query)

- **Loading**: skeletons (`Skeleton` or `bg-accent animate-pulse`), never a
  full-screen spinner. Size the skeletons like the final content.
- **Error**: `text-destructive text-sm` with the message from the contract
  envelope (`apiErrorMessage`), never a stack or raw HTTP code.
- **Empty**: `<EmptyState icon title description>` (discrete lucide icon,
  round `bg-muted`). Always explain WHY it is empty (e.g. "appears
  when the pipeline processes emails").
- Utility wrapper: `@/components/query-state` (apps).

## 4. Tables

- Rows **clickable** when a detail exists: `TableRow className="cursor-pointer"`
  + `router.push` — with a discrete icon in the last column (`FileText`,
  `size-4 muted`).
- Header row: `className="hover:bg-transparent"`, first `th` at `pl-6`,
  last `td` at `pr-6`.
- Truncation: `max-w-** truncate` on long text cells; numbers in
  `tabular-nums text-right`.
- Pagination in the card footer: `border-t px-6 py-3`, count on the left,
  `size="sm" variant="outline"` buttons on the right, disabled at bounds.

## 5. Status badges (single mapping)

Business status → Badge (in `packages/ui`, never duplicated in pages):

| Status | Variant |
|---|---|
| valide / processed / active | `success` |
| extracted / received / suspended | `warning` |
| rejete / error | `destructive` |
| paye | `default` (primary) |
| archive / inactif | `secondary` |
| neutral role (nouveau/réponse/transfert) | `outline` / `secondary` / `default` |

## 6. Details / composite views

- Grid `lg:grid-cols-3`: narrow column = metadata (Card), wide = content.
- Timeline (mailChain): 1 Card per message, header = author + role badge +
  date on the right (`text-xs muted`), content `whitespace-pre-line text-sm
  leading-relaxed`, `max-h-80 overflow-y-auto` area if long.
- Files/attachments: bordered rows `px-3 py-2` (icon + truncated name +
  `sm outline` "Open" button). Button **disabled** if the raw file is unavailable
  (`metadata.r2_key` absent) + mention "(raw unavailable)".

## 7. Mobile responsive

- Header: horizontally scrollable nav (`overflow-x-auto`), sidebar hidden
  (`lg:` breakpoint).
- Grids: `sm:grid-cols-3` (KPIs), `lg:grid-cols-3` (details), gap-4.
- Touch: targets ≥ 36px (`size="sm"` h-8 min), no hover-only.

## 8. Design-review checklist (before commit)

1. Do all pages have a PageHeader and an EmptyState?
2. Loading = sized skeletons? Error = contractual message?
3. All colors via tokens (zero custom hex/rgb)?
4. Clickable rows → cursor-pointer + discrete icon?
5. Statuses go through the ui package badges (no inline colors)?
6. Mobile: scrollable nav, stacked grids, targets ≥ 36px?
7. No business logic in packages/ui (neutral components only)?

## 9. Forbidden

- Gradients, strong shadows (`shadow-lg`+), saturated colors outside
  success/warning/destructive tokens.
- Modals for reading content (prefer pages/routes); dialogs reserved for
  destructive confirmations (native `confirm()` acceptable for now).
- Status-code colors written inline in a page.
