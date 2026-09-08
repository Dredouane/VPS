"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@alinea/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@alinea/ui/components/table";

import { Badge } from "@alinea/ui/components/badge";

import { api, queryKeys } from "@/lib/api-client";

/**
 * Journal d'exécution du suivi des emails ( consultation opérationnelle —
 * retiré du dashboard pour rester orienté décision).
 */
export function RunJournal() {
  const [open, setOpen] = useState(false);
  const runs = useQuery({
    queryKey: [...queryKeys.runs({ limit: 10, offset: 0 }), "journal"],
    queryFn: () =>
      api.GET("/api/v1/runs", { params: { query: { limit: 10, offset: 0 } } }),
    enabled: open,
  });

  return (
    <Card>
      <CardHeader
        className="cursor-pointer pb-0"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          Journal d'exécution (10 derniers passages)
        </CardTitle>
      </CardHeader>
      {open ? (
        <CardContent>
          {runs.isLoading ? (
            <div className="h-20 animate-pulse rounded-md bg-accent" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-0">Passage</TableHead>
                  <TableHead>Nouveaux emails</TableHead>
                  <TableHead>Documents lus</TableHead>
                  <TableHead>Factures détectées</TableHead>
                  <TableHead>Erreurs</TableHead>
                  <TableHead>Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runs.data?.data?.items ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-0 whitespace-nowrap">
                      {r.run_at ? new Date(r.run_at).toLocaleString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell>{r.mails_new}</TableCell>
                    <TableCell>{r.docs_indexed}</TableCell>
                    <TableCell>{r.factures_upserted}</TableCell>
                    <TableCell>
                      {r.errors > 0 ? (
                        <Badge variant="destructive">{r.errors}</Badge>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                    <TableCell>
                      {r.duration_ms != null ? `${r.duration_ms} ms` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
