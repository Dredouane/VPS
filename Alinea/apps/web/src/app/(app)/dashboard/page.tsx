"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FileText, Inbox, TriangleAlert } from "lucide-react";

import { Badge } from "@alinea/ui/components/badge";
import { Button } from "@alinea/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@alinea/ui/components/card";
import { PageHeader } from "@alinea/ui/components/page-header";
import { StatutFactureBadge } from "@alinea/ui/components/statut-facture-badge";
import { EmptyState } from "@alinea/ui/components/empty-state";
import { formatMontant } from "@alinea/ui/lib/statut-labels";

import { api, queryKeys } from "@/lib/api-client";

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number | "—";
  icon: typeof FileText;
  tone?: "warning" | "destructive" | "success";
  href?: string;
}) {
  const body = (
    <Card className="h-full">
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="mt-1 text-3xl font-semibold">{value}</p>
        </div>
        <div
          className={
            tone === "warning"
              ? "bg-warning/15 text-warning flex size-10 items-center justify-center rounded-full"
              : tone === "destructive"
                ? "bg-destructive/10 text-destructive flex size-10 items-center justify-center rounded-full"
                : "bg-success/10 text-success flex size-10 items-center justify-center rounded-full"
          }
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardPage() {
  const factures = useQuery({
    queryKey: queryKeys.factures({ statut: "extracted", limit: 5, offset: 0 }),
    queryFn: () =>
      api.GET("/api/v1/factures", {
        params: { query: { statut: "extracted", limit: 5, offset: 0 } },
      }),
  });
  const validees = useQuery({
    queryKey: [...queryKeys.factures({ statut: "valide", limit: 1, offset: 0 }), "total"],
    queryFn: () =>
      api.GET("/api/v1/factures", {
        params: { query: { statut: "valide", limit: 1, offset: 0 } },
      }),
  });
  const emailsError = useQuery({
    queryKey: [...queryKeys.emails({ status: "error", limit: 1, offset: 0 }), "total"],
    queryFn: () =>
      api.GET("/api/v1/emails", {
        params: { query: { status: "error", limit: 1, offset: 0 } },
      }),
  });

  const aTraiterItems = factures.data?.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bonjour 👋"
        description="Voici ce qui attend une décision aujourd'hui."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Factures à vérifier"
          value={factures.data?.data?.total ?? "—"}
          icon={FileText}
          tone="warning"
          href="/factures"
        />
        <KpiCard
          label="Factures validées"
          value={validees.data?.data?.total ?? "—"}
          icon={CheckCircle2}
          tone="success"
          href="/factures"
        />
        <KpiCard
          label="Échanges en erreur"
          value={emailsError.data?.data?.total ?? "—"}
          icon={TriangleAlert}
          tone="destructive"
          href="/emails"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">À traiter en priorité</CardTitle>
          <Button size="sm" variant="outline" asChild>
            <Link href="/factures">Toutes les factures</Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {factures.isLoading ? (
            <div className="h-24 animate-pulse rounded-md bg-accent" />
          ) : aTraiterItems.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Tout est à jour"
              description="Aucune facture n'attend de validation. Les nouvelles arrivées apparaîtront ici."
            />
          ) : (
            aTraiterItems.map((f) => (
              <Link
                key={f.id}
                href={`/factures/${f.id}`}
                className="flex items-center justify-between gap-3 rounded-md border px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {f.numero} — {f.fournisseur || "Fournisseur à compléter"}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatMontant(f.montant_ttc, f.devise)}
                    {f.objet ? ` · ${f.objet.slice(0, 60)}` : ""}
                  </span>
                </div>
                <StatutFactureBadge statut={f.statut} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Les échanges emails sont suivis dans{" "}
        <Link href="/chains" className="underline-offset-4 hover:underline">
          Emails
        </Link>{" "}
        ; le journal d'exécution se consulte dans{" "}
        <Link href="/emails" className="underline-offset-4 hover:underline">
          Traitement
        </Link>
        .
      </p>
    </div>
  );
}
