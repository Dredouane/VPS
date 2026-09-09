"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessagesSquare, X } from "lucide-react";

import { Button } from "@alinea/ui/components/button";

import { api, queryKeys } from "@/lib/api-client";
import { ChatPanel, type ChatScope } from "@/components/chat-panel";

/**
 * Assistant réduit en bulle flottante (pattern Facebook) : le chat n'occupe
 * pas le flux des pages détail — il s'ouvre au clic, en panneau ancré en bas
 * à droite. Badge = taille de l'historique.
 */
export function ChatBubble({
  scope,
  suggestions,
  title,
  intro,
}: {
  scope: ChatScope;
  suggestions?: string[];
  title: string;
  intro: string;
}) {
  const [open, setOpen] = useState(false);

  const messages = useQuery({
    queryKey: [...(scope.type === "chain" ? queryKeys.chains({ limit: 1, offset: 0 }) : queryKeys.facture(scope.id)), "chat", scope.type, scope.id, "count"],
    queryFn: () =>
      scope.type === "chain"
        ? api.GET("/api/v1/chains/{threadId}/messages", {
            params: { path: { threadId: scope.id } },
          })
        : api.GET("/api/v1/factures/{id}/chat", {
            params: { path: { id: scope.id } },
          }),
    staleTime: 60_000,
  });
  const count = messages.data?.data?.total ?? 0;

  return (
    <>
      {open ? (
        <div className="fixed bottom-4 right-4 z-50 flex w-[min(94vw,400px)] flex-col">
          <Button
            size="icon"
            variant="outline"
            className="absolute -top-3 -right-3 z-10 rounded-full shadow-sm"
            aria-label="Fermer l'assistant"
            onClick={() => setOpen(false)}
          >
            <X className="size-4" />
          </Button>
          <div className="max-h-[min(70vh,560px)] overflow-hidden rounded-xl shadow-xl">
            <ChatPanel scope={scope} title={title} intro={intro} suggestions={suggestions} />
          </div>
        </div>
      ) : (
        <button
          className="bg-primary text-primary-foreground hover:bg-primary/90 fixed right-4 bottom-4 z-40 flex size-13 cursor-pointer items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
          aria-label={`Ouvrir l'assistant${count > 0 ? ` (${count} échange${count > 1 ? "s" : ""})` : ""}`}
          onClick={() => setOpen(true)}
        >
          <MessagesSquare className="size-6" />
          {count > 0 ? (
            <span className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
              {count}
            </span>
          ) : null}
        </button>
      )}
    </>
  );
}
