"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

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

import { api, queryKeys } from "@/lib/api-client";
import { EMAIL_STATUSES, type EmailStatus } from "@/lib/enums";

const PAGE_SIZE = 25;
type Status = EmailStatus;

export default function EmailsPage() {
  const [status, setStatus] = useState<Status | undefined>(undefined);
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Emails</h1>
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
              {s}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent>
          {emails.isLoading ? (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          ) : emails.error ? (
            <p className="text-destructive text-sm">
              {(emails.error as { error?: { message?: string } }).error?.message}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reçu le</TableHead>
                    <TableHead>De</TableHead>
                    <TableHead>Sujet</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
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
                      <TableCell>{m.classification ?? "—"}</TableCell>
                      <TableCell>
                        {m.status === "error" ? (
                          <Badge variant="destructive">error</Badge>
                        ) : m.status === "processed" ? (
                          <Badge variant="success">processed</Badge>
                        ) : (
                          <Badge variant="warning">received</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Aucun email{status ? ` (${status})` : ""}.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>

              <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
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
    </div>
  );
}
