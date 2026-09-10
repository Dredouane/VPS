"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";

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
import { EmptyState } from "@alinea/ui/components/empty-state";

import { api, queryKeys } from "@/lib/api-client";
import { normalizeParticipants } from "@/lib/chains";

const PAGE_SIZE = 25;

export default function ChainsPage() {
  const router = useRouter();
  const [offset, setOffset] = useState(0);

  const chains = useQuery({
    queryKey: queryKeys.chains({ limit: PAGE_SIZE, offset }),
    queryFn: () =>
      api.GET("/api/v1/chains", {
        params: { query: { limit: PAGE_SIZE, offset } },
      }),
  });

  const items = chains.data?.data?.items ?? [];
  const total = chains.data?.data?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conversations Emails"
        description="Vos échanges emails et documents associés."
      />

      <Card className="py-0">
        <CardContent className="px-0">
          {chains.isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-accent" />
              ))}
            </div>
          ) : chains.error ? (
            <p className="text-destructive p-6 text-sm">
              {(chains.error as { error?: { message?: string } }).error?.message}
            </p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="Aucune conversation"
              description="Les échanges apparaissent ici dès qu'un email est reçu."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Sujet</TableHead>
                    <TableHead>Participants</TableHead>
                    <TableHead className="text-right">Messages</TableHead>
                    <TableHead>Dernier message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => {
                    const participants = normalizeParticipants(c.participants);
                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(`/chains/${encodeURIComponent(c.thread_id)}`)
                        }
                      >
                        <TableCell className="pl-6 max-w-72 font-medium">
                          <span className="truncate">{c.subject ?? "(sans sujet)"}</span>
                        </TableCell>
                        <TableCell className="max-w-56 truncate text-muted-foreground">
                          {participants.length > 0
                            ? participants.join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.messages_count}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {c.last_message_at
                            ? new Date(c.last_message_at).toLocaleString("fr-FR")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="text-muted-foreground flex items-center justify-between border-t px-6 py-3 text-sm">
                <span>
                  {total} conversation{total > 1 ? "s" : ""}
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
