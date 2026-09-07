"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { Badge } from "@alinea/ui/components/badge";
import { Button } from "@alinea/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@alinea/ui/components/card";
import { Input } from "@alinea/ui/components/input";
import { PageHeader } from "@alinea/ui/components/page-header";

import { api, apiErrorMessage } from "@/lib/api-client";

export default function RecherchePage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const search = useMutation({
    mutationFn: (q: string) =>
      api.POST("/api/v1/documents/search", {
        body: { query: q, match_count: 8 },
      }),
  });

  const items = search.data?.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Recherche RAG"
        description="Recherche sémantique sur les documents indexés (emails + pièces jointes OCR)"
      />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query);
          if (query.trim()) search.mutate(query);
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex : facture électricité mars, devis terrassement…"
        />
        <Button type="submit" disabled={search.isPending || !query.trim()}>
          {search.isPending ? "…" : "Rechercher"}
        </Button>
      </form>

      {search.isError ? (
        <p className="text-destructive text-sm">{apiErrorMessage(search.error)}</p>
      ) : null}

      {submitted && !search.isPending ? (
        <p className="text-muted-foreground text-sm">
          {items.length} résultat{items.length > 1 ? "s" : ""} pour « {submitted} »
        </p>
      ) : null}

      <div className="grid gap-3">
        {items.map((doc) => (
          <Card key={doc.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">
                  {doc.title ?? doc.content.slice(0, 60)}
                </CardTitle>
                <Badge variant="secondary">
                  {Math.round(doc.similarity * 100)} %
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground line-clamp-4 whitespace-pre-line text-sm">
                {doc.content}
              </p>
              <p className="mt-2 text-xs">{doc.kind}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
