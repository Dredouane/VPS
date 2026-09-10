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

export type ChatScope = { type: "chain" | "facture"; id: string };

/**
 * Assistant sourcé réutilisable (TKT-107 conversation / TKT-203 facture) :
 * historique persistant + envoi de question + sources citées.
 */
export function ChatPanel({
  scope,
  suggestions,
  title = "Assistant",
  intro = "Répond à partir du contexte concerné uniquement — sources citées.",
}: {
  scope: ChatScope;
  suggestions?: string[];
  title?: string;
  intro?: string;
}) {
  const queryClient = useQueryClient();
  const [question, setQuestion] = useState("");

  const chatKey =
    scope.type === "chain"
      ? queryKeys.chains({ limit: 1, offset: 0 })
      : queryKeys.facture(scope.id);

  const messages = useQuery({
    queryKey: [...chatKey, "chat", scope.type, scope.id],
    queryFn: () =>
      scope.type === "chain"
        ? api.GET("/api/v1/chains/{threadId}/messages", {
            params: { path: { threadId: scope.id } },
          })
        : api.GET("/api/v1/factures/{id}/chat", {
            params: { path: { id: scope.id } },
          }),
  });

  const ask = useMutation({
    mutationFn: (q: string) =>
      scope.type === "chain"
        ? api.POST("/api/v1/chains/{threadId}/chat", {
            params: { path: { threadId: scope.id } },
            body: { question: q },
          })
        : api.POST("/api/v1/factures/{id}/chat", {
            params: { path: { id: scope.id } },
            body: { question: q },
          }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...chatKey, "chat", scope.type, scope.id],
      });
    },
  });

  function send(q: string) {
    if (!q.trim() || ask.isPending) return;
    setQuestion("");
    ask.mutate(q.trim());
  }

  const items = messages.data?.data?.items ?? [];
  const showSuggestions = suggestions && items.length === 0;

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden py-0">
      <CardHeader className="shrink-0 py-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-muted-foreground text-xs">{intro}</p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-4">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {messages.isLoading ? (
            <>
              <Skeleton className="h-14 w-4/5" />
              <Skeleton className="ml-auto h-10 w-3/5" />
            </>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-sm">
              {intro}
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
                    {(m.sources ?? []).map((s, i) => (
                      <Badge key={`${s.id}-${i}`} variant="secondary" className="text-[10px]">
                        {(s as { kind: string }).kind === "attachment" ? "PJ" : (s as { kind: string }).kind === "fiche" ? "Fiche" : "Mail"}:{" "}
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

        {showSuggestions ? (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                onClick={() => send(s)}
                disabled={ask.isPending}
              >
                {s}
              </Button>
            ))}
          </div>
        ) : null}

        <form onSubmit={(e) => { e.preventDefault(); send(question); }} className="flex shrink-0 gap-2 border-t pt-3">
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
