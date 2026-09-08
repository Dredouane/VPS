/**
 * Vocabulaire utilisateur normé (TKT-102) : libellés FR affichés — les
 * codes backend/SQL restent inchangés (l'affichage traduit, jamais la donnée).
 */

export const FACTURE_STATUT_LABELS: Record<string, string> = {
  extracted: "À traiter",
  valide: "Validée",
  rejete: "Rejetée",
  paye: "Payée",
  archive: "Archivée",
};

export const EMAIL_STATUS_LABELS: Record<string, string> = {
  received: "À traiter",
  processed: "Traitée",
  error: "En erreur",
};

/** Montants au format FR : 60 226,08 € (virgule décimale, espace milliers). */
export function formatMontant(
  montant: number | null | undefined,
  devise = "EUR"
): string {
  if (montant == null) return "à compléter";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise,
  }).format(montant);
}

/** Dates au format FR court. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
