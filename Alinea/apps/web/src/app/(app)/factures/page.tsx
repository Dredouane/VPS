"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

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
import { cn } from "@alinea/ui/lib/utils";

import { api, queryKeys, type Facture } from "@/lib/api-client";
import { FACTURE_STATUTS, type FactureStatut } from "@/lib/enums";

const PAGE_SIZE = 25;

type Statut = FactureStatut;

export default function FacturesPage() {
  const [statut, setStatut] = useState<Statut | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  const factures = useQuery({
    queryKey: queryKeys.factures({ statut, limit: PAGE_SIZE, offset }),
    queryFn: () =>
      api.GET("/api/v1/factures", {
        params: {
          query: { statut, limit: PAGE_SIZE, offset },
        },
      }),
  });

  const items = factures.data?.data?.items ?? [];
  const total = factures.data?.data?.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Factures</h1>
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
              {s}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent>
          {factures.isLoading ? (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          ) : factures.error ? (
            <p className="text-destructive text-sm">
              {(factures.error as { error?: { message?: string } }).error?.message}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead>Objet</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">TTC</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((f: Facture) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/factures/${f.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {f.numero}
                        </Link>
                      </TableCell>
                      <TableCell>{f.fournisseur || "—"}</TableCell>
                      <TableCell className="max-w-48 truncate">
                        {f.objet ?? "—"}
                      </TableCell>
                      <TableCell>{f.date_echeance ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {f.montant_ttc != null
                          ? `${f.montant_ttc.toFixed(2)} ${f.devise}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatutFactureBadge statut={f.statut} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        Aucune facture{statut ? ` (${statut})` : ""}.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>

              <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
                <span>
                  {total} résultat{total > 1 ? "s" : ""}
                  {statut ? ` · ${statut}` : ""}
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
