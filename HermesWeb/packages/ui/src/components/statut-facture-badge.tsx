import { Badge } from "#components/badge";
import type { VariantProps } from "class-variance-authority";
import { cn } from "#lib/utils";

/**
 * Badge de statut de facture — mapping visuel centralisé
 * (extracted / valide / rejete / paye / archive).
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
  return (
    <Badge variant={variant} className={cn(className)}>
      {statut}
    </Badge>
  );
}

export { StatutFactureBadge, STATUT_FACTURE_VARIANTS };
export type { StatutFacture };
