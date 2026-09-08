import { Badge } from "#components/badge";
import type { VariantProps } from "class-variance-authority";
import { cn } from "#lib/utils";
import { FACTURE_STATUT_LABELS } from "#lib/statut-labels";

/**
 * Badge de statut de facture — mapping visuel + libellé FR normé (TKT-102),
 * centralisé ici (jamais dupliqué dans les pages).
 */
const STATUT_FACTURE_VARIANTS = {
  extracted: "warning",
  valide: "success",
  rejete: "destructive",
  paye: "default",
  archive: "secondary",
} as const;

type StatutFacture = keyof typeof STATUT_FACTURE_VARIANTS;
type BadgeVariant = NonNullable<VariantProps<typeof Badge>["variant"]>;

function StatutFactureBadge({
  statut,
  className,
}: {
  statut: StatutFacture | (string & {});
  className?: string;
}) {
  const variants = STATUT_FACTURE_VARIANTS as Record<StatutFacture, BadgeVariant>;
  const variant: BadgeVariant =
    (statut in variants ? variants[statut as StatutFacture] : undefined) ?? "outline";
  const label = FACTURE_STATUT_LABELS[statut as string] ?? statut;
  return (
    <Badge variant={variant} className={cn(className)}>
      {label}
    </Badge>
  );
}

export { StatutFactureBadge, STATUT_FACTURE_VARIANTS };
export type { StatutFacture };
