---
name: alinea-design
description: Guide design de la webapp Alinea (Next.js + shadcn + Tailwind v4) — tokens, shells de page, états, tables, badges de statut, responsive. Use when the user says "design pass", "revoir le design", "alinea-design", "design system", or when creating/modifying pages or components in Alinea — to keep the UI sobre, cohérente et revisable sans casser.
---

# 🎨 alinea-design — Design system Alinea

Style : **sobre, pro, dense**. Backoffice clients PME (desktop prioritaire,
mobile supporté). Ne jamais surcharger : couleurs = tokens uniquement,
pas de gradients, pas d'ombres fortes.

## 1. Où vit quoi (règle d'or)

| Type | Emplacement | Exemple |
|---|---|---|
| Tokens + primitives génériques | `Alinea/packages/ui` | button, card, badge, page-header, empty-state, skeleton |
| Composants métier neutres | `packages/ui` (mapper l'état → variante) | statut-facture-badge |
| Logique de page + queries TanStack | `Alinea/apps/web/src/app/(app)/*` | dashboard, factures, chains |

Une refonte visuelle = modifier `packages/ui` (tokens + primitives) —
les pages ne changent pas. Inversement : une page ne contient JAMAIS de
couleur/tailles custom hors tokens (`text-muted-foreground`, `bg-accent`…).

## 2. Shells de page obligatoires

- Toute page principale commence par `<PageHeader title description actions?>`
  (titre `text-2xl font-semibold tracking-tight`, description `text-sm muted`).
- Les filtres/actions secondaires vont dans `actions` (boutons `size="sm"`).
- Contenu principal dans une `<Card className="py-0">` + `<CardContent className="px-0">`
  pour les tables (bordures au fil de la carte, padding géré par les cellules).

## 3. États (TANStack Query)

- **Loading** : skeletons (`Skeleton` ou `bg-accent animate-pulse`), jamais de
  spinner plein écran. Dimensionner les skeletons comme le contenu final.
- **Erreur** : `text-destructive text-sm` avec le message de l'enveloppe
  contractuelle (`apiErrorMessage`), jamais de stack ni de code HTTP brut.
- **Vide** : `<EmptyState icon title description>` (icône lucide discrète,
  ronde `bg-muted`). Toujours expliquer POURQUOI c'est vide (ex : "apparaît
  quand le pipeline traite les emails").
- Wrapper utilitaire : `@/components/query-state` (apps).

## 4. Tables

- Rows **cliquables** quand un détail existe : `TableRow className="cursor-pointer"`
  + `router.push` — avec une icône discrète en dernière colonne (`FileText`,
  `size-4 muted`).
- Header row : `className="hover:bg-transparent"`, premier `th` en `pl-6`,
  dernier `td` en `pr-6`.
- Truncation : `max-w-** truncate` sur cellules texte long ; nombres en
  `tabular-nums text-right`.
- Pagination en footer de carte : `border-t px-6 py-3`, compte à gauche,
  boutons `size="sm" variant="outline"` à droite, disabled aux bornes.

## 5. Badges de statut (mapping unique)

Statut métier → Badge (dans `packages/ui`, jamais dupliqué dans les pages) :

| Statut | Variante |
|---|---|
| valide / processed / active | `success` |
| extracted / received / suspended | `warning` |
| rejete / error | `destructive` |
| paye | `default` (primary) |
| archive / inactif | `secondary` |
| rôle neutre (nouveau/réponse/transfert) | `outline` / `secondary` / `default` |

## 6. Détails / vues composites

- Grille `lg:grid-cols-3` : colonne étroite = metadata (Card), large = contenu.
- Timeline (mailChain) : 1 Card par message, header = auteur + badge rôle +
  date à droite (`text-xs muted`), contenu `whitespace-pre-line text-sm
  leading-relaxed`, zone `max-h-80 overflow-y-auto` si long.
- Fichiers/PJ : rangées bordées `px-3 py-2` (icône + nom truncate + bouton
  `sm outline` "Ouvrir"). Bouton **disabled** si le brut est indisponible
  (`metadata.r2_key` absent) + mention "(brut indisponible)".

## 7. Responsive mobile

- Header : nav horizontale scrollable (`overflow-x-auto`), sidebar cachée
  (`lg:` breakpoint).
- Grilles : `sm:grid-cols-3` (KPI), `lg:grid-cols-3` (détails), gap-4.
- Touch : targets ≥ 36px (`size="sm"` h-8 min), pas de hover-only.

## 8. Checklist design-review (avant commit)

1. Chaque page a un PageHeader et un EmptyState ?
2. Loading = skeletons dimensionnés ? Erreur = message contractuel ?
3. Toutes les couleurs via tokens (zéro hex/rgb custom) ?
4. Rows cliquables → cursor-pointer + icône discrète ?
5. Statuts passent par les badges du package ui (pas de couleur inline) ?
6. Mobile : nav scrollable, grilles empilées, targets ≥ 36px ?
7. Aucune logique métier dans packages/ui (composants neutres uniquement) ?

## 9. Interdits

- Gradients, ombres fortes (`shadow-lg`+), couleurs saturées hors tokens
  success/warning/destructive.
- Modals pour lire du contenu (préférer pages/routes) ; dialogs réservés aux
  confirmations destructives (`confirm()` natif acceptable pour l'instant).
- Couleurs par code statut écrites inline dans une page.
