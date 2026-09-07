"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@hermesweb/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@hermesweb/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@hermesweb/ui/components/table";

import { api, queryKeys } from "@/lib/api-client";

function KpiCard({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number | "—";
  tone?: "warning" | "destructive";
  href?: string;
}) {
  const body = (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <CardTitle className="text-muted-foreground text-xs font-medium">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">
          {value}
          {tone ? (
            <Badge variant={tone} className="ml-2 align-middle text-[10px]">
              {tone === "warning" ? "action" : "à surveiller"}
            </Badge>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardPage() {
  const runs = useQuery({
    queryKey: queryKeys.runs({ limit: 8, offset: 0 }),
    queryFn: () =>
      api.GET("/api/v1/runs", { params: { query: { limit: 8, offset: 0 } } }),
  });
  const facturesTotal = useQuery({
    queryKey: [...queryKeys.factures({ limit: 1, offset: 0 }), "total"],
    queryFn: () =>
      api.GET("/api/v1/factures", {
        params: { query: { limit: 1, offset: 0 } },
      }),
  });
  const facturesAValider = useQuery({
    queryKey: [...queryKeys.factures({ statut: "extracted", limit: 1, offset: 0 }), "total"],
    queryFn: () =>
      api.GET("/api/v1/factures", {
        params: { query: { statut: "extracted", limit: 1, offset: 0 } },
      }),
  });
  const emailsError = useQuery({
    queryKey: [...queryKeys.emails({ status: "error", limit: 1, offset: 0 }), "total"],
    queryFn: () =>
      api.GET("/api/v1/emails", {
        params: { query: { status: "error", limit: 1, offset: 0 } },
      }),
  });

  const loading =
    runs.isLoading || facturesTotal.isLoading || facturesAValider.isLoading || emailsError.isLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Pipeline email → facturation (silencieux, consultation D11)
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Factures (total)"
            value={facturesTotal.data?.data?.total ?? "—"}
            href="/factures"
          />
          <KpiCard
            label="Factures à valider"
            value={facturesAValider.data?.data?.total ?? "—"}
            tone="warning"
            href="/factures?statut=extracted"
          />
          <KpiCard
            label="Emails en erreur"
            value={emailsError.data?.data?.total ?? "—"}
            tone="destructive"
            href="/emails"
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Derniers runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.isLoading ? (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          ) : runs.error ? (
            <p className="text-destructive text-sm">
              {(runs.error as { error?: { message?: string } }).error?.message}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run at</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Mails new</TableHead>
                  <TableHead>Docs indexés</TableHead>
                  <TableHead>Factures</TableHead>
                  <TableHead>Erreurs</TableHead>
                  <TableHead>Durée</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runs.data?.data?.items ?? []).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      {run.run_at ? new Date(run.run_at).toLocaleString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell>{run.run_trigger}</TableCell>
                    <TableCell>{run.mails_new}</TableCell>
                    <TableCell>{run.docs_indexed}</TableCell>
                    <TableCell>{run.factures_upserted}</TableCell>
                    <TableCell>
                      {run.errors > 0 ? (
                        <Badge variant="destructive">{run.errors}</Badge>
                      ) : (
                        run.errors
                      )}
                    </TableCell>
                    <TableCell>
                      {run.duration_ms != null ? `${run.duration_ms} ms` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {(runs.data?.data?.items ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Aucun run enregistré.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
