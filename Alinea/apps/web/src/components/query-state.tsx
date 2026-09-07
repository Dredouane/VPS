"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Inbox } from "lucide-react";

import { Skeleton } from "@alinea/ui/components/skeleton";
import { EmptyState } from "@alinea/ui/components/empty-state";

/**
 * Wrapper d'état pour les queries TanStack : skeleton pendant le chargement,
 * message d'erreur contractuel, EmptyState si vide — les pages restent
 * concentrées sur le contenu.
 */
export function QueryState<TData extends { items?: unknown[] } | null | undefined>({
  query,
  emptyTitle,
  emptyDescription,
  children,
}: {
  query: UseQueryResult<{ data?: TData; error?: unknown }>;
  emptyTitle?: string;
  emptyDescription?: string;
  children: (data: NonNullable<TData>) => React.ReactNode;
}) {
  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
    );
  }
  const err = query.error as { error?: { message?: string } } | null;
  if (err?.error) {
    return (
      <EmptyState
        icon={Inbox}
        title="Erreur"
        description={err.error.message ?? "Une erreur est survenue."}
      />
    );
  }
  const data = query.data?.data as NonNullable<TData> | undefined;
  if (!data) return null;
  if ("items" in data && (!data.items || data.items.length === 0)) {
    return (
      <EmptyState
        icon={Inbox}
        title={emptyTitle ?? "Aucun résultat"}
        description={emptyDescription}
      />
    );
  }
  return <>{children(data)}</>;
}
