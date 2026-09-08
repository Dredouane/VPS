"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";

import { Badge } from "@alinea/ui/components/badge";
import { Button } from "@alinea/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@alinea/ui/components/card";
import { Input } from "@alinea/ui/components/input";
import { Skeleton } from "@alinea/ui/components/skeleton";

import { api, apiErrorMessage, queryKeys } from "@/lib/api-client";

/**
 * Assistant « poser une question » sur une conversation (TKT-107) :
 * historique persistant (GET messages) + envoi (POST chat) avec sources
 * citées. Isolé au fil courant côté serveur (C7).
 */
export function ChatPanel({ threadId }: { threadId: string }) {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");

  const messages = useQuery({
    queryKey: [...queryKeys.chains({ limit: 1, offset: 0 }), "chat", threadId],
    queryFn: () =>
      api.GET("/api/v1/chains/{threadId}/messages", {
        params: { path: { threadId } },
      }),
  });

  const ask = useMutation({
    mutationFn: (q: string) =>
      api.POST("/api/v1/chains/{threadId}/chat", {
        params: { path: { threadId } },
        body: { question: q },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.chains({ limit: 1, offset: 0 }), "chat", threadId],
      });
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || ask.isPending) return;
    setQuestion("");
    ask.mutate(q);
  }

  const items = messages.data?.data?.items ?? [];

  return (
    <Card className="sticky top-20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Assistant de la conversation</CardTitle>
        <p className="text-muted-foreground text-xs">
          Répond à partir de cet échange uniquement — sources citées.
        </p>
      </CardHeader>
      <CardContent className="flex max-h-[70vh] flex-col gap-3">
        <div className="flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto">
          {messages.isLoading ? (
            <>
              <Skeleton className="h-14 w-4/5" />
              <Skeleton className="ml-auto h-10 w-3/5" />
            </>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Posez une question sur cet échange (ex : « Qui était le
              destinataire ? », « Quel est le montant demandé ? »).
            </p>
          ) : (
            items.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto max-w-[85%] rounded-lg px-3 py-2 text-sm"
                    : "bg-muted max-w-[95%] rounded-lg px-3 py-2 text-sm"
                }
              >
                <p className="whitespace-pre-line">{m.content}</p>
                {m.role === "assistant" && (m.sources ?? []).length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(m.sources ?? []).map((s) => (
                      <Badge
                        key={s.id}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {s.kind === "attachment" ? "PJ" : "Mail"}:{" "}
                        {s.title ?? "—"} · {Math.round(s.similarity * 100)}%
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
          {ask.isPending ? (
            <div className="bg-muted max-w-[95%] animate-pulse rounded-lg px-3 py-2 text-sm">
              Réflexion…
            </div>
          ) : null}
          {ask.error ? (
            <p className="text-destructive text-xs">{apiErrorMessage(ask.error)}</p>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 border-t pt-3">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Votre question…"
            maxLength={2000}
          />
          <Button
            type="submit"
            size="icon"
            disabled={ask.isPending || !question.trim()}
            aria-label="Envoyer"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
