"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Inbox } from "lucide-react";

import { Button } from "@alinea/ui/components/button";
import { Card, CardContent } from "@alinea/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@alinea/ui/components/table";
import { StatutFactureBadge } from "@alinea/ui/components/statut-facture-badge";
import { PageHeader } from "@alinea/ui/components/page-header";
import {
  FACTURE_STATUT_LABELS,
  formatMontant,
} from "@alinea/ui/lib/statut-labels";

import { api, queryKeys, type Facture } from "@/lib/api-client";
import { FACTURE_STATUTS, type FactureStatut } from "@/lib/enums";
import { QueryState } from "@/components/query-state";

const PAGE_SIZE = 25;

export default function FacturesPage() {
  const router = useRouter();
  const [statut, setStatut] = useState<FactureStatut | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  const factures = useQuery({
    queryKey: queryKeys.factures({ statut, limit: PAGE_SIZE, offset }),
    queryFn: () =>
      api.GET("/api/v1/factures", {
        params: { query: { statut, limit: PAGE_SIZE, offset } },
      }),
  });
  const aTraiter = useQuery({
    queryKey: [...queryKeys.factures({ statut: "extracted", limit: 1, offset: 0 }), "total"],
    queryFn: () =>
      api.GET("/api/v1/factures", {
        params: { query: { statut: "extracted", limit: 1, offset: 0 } },
      }),
  });

  const items = factures.data?.data?.items ?? [];
  const total = factures.data?.data?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Factures"
        description="Extraites automatiquement depuis vos emails — à vérifier puis valider"
        actions={
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={statut === undefined ? "default" : "outline"}
              onClick={() => {
                setStatut(undefined);
                setOffset(0);
              }}
            >
              Toutes
            </Button>
            {FACTURE_STATUTS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statut === s ? "default" : "outline"}
                onClick={() => {
                  setStatut(s);
                  setOffset(0);
                }}
              >
                {FACTURE_STATUT_LABELS[s]}
              </Button>
            ))}
          </div>
        }
      />

      {!factures.isLoading && aTraiter.data?.data?.total ? (
        <p className="text-sm font-medium">
          <span className="bg-warning text-warning-foreground mr-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs">
            {aTraiter.data.data.total}
          </span>
          facture{(aTraiter.data.data.total ?? 0) > 1 ? "s" : ""} à vérifier et
          valider
        </p>
      ) : null}

      <Card className="py-0">
        <CardContent className="px-0">
          {factures.isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-accent" />
              ))}
            </div>
          ) : factures.error ? (
            <p className="text-destructive p-6 text-sm">
              {(factures.error as { error?: { message?: string } }).error?.message}
            </p>
          ) : items.length === 0 ? (
            <div className="p-6">
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Inbox className="size-4" />
                {statut
                  ? `Aucune facture « ${FACTURE_STATUT_LABELS[statut]} ».`
                  : "Aucune facture pour le moment — elles apparaissent dès que le suivi des emails en détecte une."}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Numéro</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="max-w-64">Objet</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead aria-label="actions" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((f: Facture) => (
                    <TableRow
                      key={f.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/factures/${f.id}`)}
                    >
                      <TableCell className="pl-6 font-medium">{f.numero}</TableCell>
                      <TableCell>{f.fournisseur || "—"}</TableCell>
                      <TableCell className="max-w-64 truncate text-muted-foreground">
                        {f.objet ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {f.date_echeance ?? (
                          <span className="text-warning">à compléter</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMontant(f.montant_ttc, f.devise)}
                      </TableCell>
                      <TableCell>
                        <StatutFactureBadge statut={f.statut} />
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <FileText className="text-muted-foreground inline size-4" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-muted-foreground flex items-center justify-between border-t px-6 py-3 text-sm">
                <span>
                  {total} résultat{total > 1 ? "s" : ""}
                  {statut ? ` · ${FACTURE_STATUT_LABELS[statut]}` : ""}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    Précédent
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={offset + PAGE_SIZE >= total}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
