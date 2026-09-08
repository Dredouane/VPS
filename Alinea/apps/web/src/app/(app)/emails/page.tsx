"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";

import { Badge } from "@alinea/ui/components/badge";
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
import { PageHeader } from "@alinea/ui/components/page-header";

import { api, queryKeys } from "@/lib/api-client";
import { EMAIL_STATUSES, type EmailStatus } from "@/lib/enums";
import { EMAIL_STATUS_LABELS } from "@alinea/ui/lib/statut-labels";
import { RunJournal } from "@/components/run-journal";

const PAGE_SIZE = 25;

export default function EmailsPage() {
  const router = useRouter();
  const [status, setStatus] = useState<EmailStatus | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  const emails = useQuery({
    queryKey: queryKeys.emails({ status, limit: PAGE_SIZE, offset }),
    queryFn: () =>
      api.GET("/api/v1/emails", {
        params: { query: { status, limit: PAGE_SIZE, offset } },
      }),
  });

  const items = emails.data?.data?.items ?? [];
  const total = emails.data?.data?.total ?? 0;

  const statusBadge = (s: string) =>
    s === "error" ? (
      <Badge variant="destructive">{EMAIL_STATUS_LABELS.error}</Badge>
    ) : s === "processed" ? (
      <Badge variant="success">{EMAIL_STATUS_LABELS.processed}</Badge>
    ) : (
      <Badge variant="warning">{EMAIL_STATUS_LABELS.received}</Badge>
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Traitement"
        description="Suivi de traitement des emails reçus — les conversations vivent dans Emails."
        actions={
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={status === undefined ? "default" : "outline"}
              onClick={() => {
                setStatus(undefined);
                setOffset(0);
              }}
            >
              Tous
            </Button>
            {EMAIL_STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={status === s ? "default" : "outline"}
                onClick={() => {
                  setStatus(s);
                  setOffset(0);
                }}
              >
                {EMAIL_STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        }
      />

      <Card className="py-0">
        <CardContent className="px-0">
          {emails.isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-accent" />
              ))}
            </div>
          ) : emails.error ? (
            <p className="text-destructive p-6 text-sm">
              {(emails.error as { error?: { message?: string } }).error?.message}
            </p>
          ) : items.length === 0 ? (
            <div className="p-6">
              <p className="text-muted-foreground text-sm">
                Aucun email{status ? ` (${status})` : ""}.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Reçu le</TableHead>
                    <TableHead>De</TableHead>
                    <TableHead className="max-w-64">Sujet</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((m) => (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/emails/${m.id}`)}
                    >
                      <TableCell className="pl-6 whitespace-nowrap">
                        {m.mail_date
                          ? new Date(m.mail_date).toLocaleString("fr-FR")
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-44 truncate">
                        {m.from_addr ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-64 truncate">
                        {m.subject ?? "—"}
                      </TableCell>
                      <TableCell>
                        {m.classification ? (
                          <Badge variant="secondary">{m.classification}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(m.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-muted-foreground flex items-center justify-between border-t px-6 py-3 text-sm">
                <span>
                  {total} résultat{total > 1 ? "s" : ""}
                  {status ? ` · ${status}` : ""}
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
      <RunJournal />
    </div>
  );
}
