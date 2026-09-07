"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, FileText, Inbox } from "lucide-react";

import { Badge } from "@alinea/ui/components/badge";
import { Button } from "@alinea/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@alinea/ui/components/card";
import { PageHeader } from "@alinea/ui/components/page-header";
import { EmptyState } from "@alinea/ui/components/empty-state";
import { Separator } from "@alinea/ui/components/separator";

import { api, apiErrorMessage } from "@/lib/api-client";

function usePresign() {
  return useMutation({
    mutationFn: (documentId: string) =>
      api.GET("/api/v1/files/{documentId}", {
        params: { path: { documentId } },
      }),
    onSuccess: (res) => {
      if (res.data?.url) window.open(res.data.url, "_blank", "noopener");
    },
  });
}

function DocRow({
  id,
  label,
  onOpen,
  pending,
}: {
  id: string;
  label: string;
  onOpen: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="text-muted-foreground size-4 shrink-0" />
        <span className="truncate text-sm">{label}</span>
      </div>
      <Button size="sm" variant="outline" onClick={onOpen} disabled={pending}>
        <ExternalLink className="size-3.5" />
        Voir le brut
      </Button>
    </div>
  );
}

export default function EmailDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const presign = usePresign();

  const email = useQuery({
    queryKey: ["email", id],
    queryFn: () => api.GET("/api/v1/emails/{id}", { params: { path: { id } } }),
  });
  const messageId = email.data?.data?.message_id;

  const content = useQuery({
    queryKey: ["email-content", messageId],
    enabled: !!messageId,
    queryFn: () =>
      api.GET("/api/v1/documents", {
        params: { query: { message_id: messageId!, kind: "email", limit: 1, offset: 0 } },
      }),
  });
  const attachments = useQuery({
    queryKey: ["email-attachments", messageId],
    enabled: !!messageId,
    queryFn: () =>
      api.GET("/api/v1/documents", {
        params: { query: { parent_message_id: messageId!, kind: "attachment", limit: 50, offset: 0 } },
      }),
  });

  const m = email.data?.data;
  const doc = content.data?.data?.items?.[0];
  const atts = attachments.data?.data?.items ?? [];

  if (email.isLoading) {
    return <p className="text-muted-foreground text-sm">Chargement…</p>;
  }
  if (email.error) {
    return (
      <p className="text-destructive text-sm">{apiErrorMessage(email.error)}</p>
    );
  }
  if (!m) return null;

  const meta = (m.raw_metadata ?? {}) as {
    date?: string;
    classification?: string;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={m.subject ?? "(sans sujet)"}
        description={m.from_addr ?? undefined}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
            Retour
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Traitement</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Statut</span>
              {m.status === "error" ? (
                <Badge variant="destructive">error</Badge>
              ) : m.status === "processed" ? (
                <Badge variant="success">processed</Badge>
              ) : (
                <Badge variant="warning">received</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Classification</span>
              <span>{m.classification ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Reçu le</span>
              <span>
                {m.mail_date ? new Date(m.mail_date).toLocaleString("fr-FR") : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Date meta</span>
              <span>{meta.date ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tentatives</span>
              <span>{m.attempts}</span>
            </div>
            <Separator className="my-1" />
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">
                Résumé (LLM — M2.6-bis)
              </p>
              <p className="text-sm">
                {m.resume ?? (
                  <span className="text-muted-foreground">
                    Pas encore de résumé (classification branchée en M2.6-bis).
                  </span>
                )}
              </p>
            </div>
            {m.error ? (
              <>
                <Separator className="my-1" />
                <p className="text-destructive text-xs">{m.error}</p>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Contenu extrait</CardTitle>
          </CardHeader>
          <CardContent>
            {content.isLoading ? (
              <div className="h-40 animate-pulse rounded-md bg-accent" />
            ) : doc ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">
                {doc.content}
              </p>
            ) : (
              <EmptyState
                icon={Inbox}
                title="Pas de contenu indexé"
                description="Le contenu de ce mail n'a pas été indexé (mail cité uniquement ou erreur d'embedding)."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pièces jointes ({atts.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {atts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune pièce jointe.</p>
          ) : (
            atts.map((a) => {
              const meta = (a.metadata ?? {}) as {
                r2_key?: string;
                filename?: string;
              };
              return (
                <DocRow
                  key={a.id}
                  id={a.id}
                  label={
                    meta.filename
                      ? `${meta.filename}${meta.r2_key ? "" : " (brut indisponible)"}`
                      : a.title ?? a.id.slice(0, 8)
                  }
                  onOpen={() => presign.mutate(a.id)}
                  pending={presign.isPending && presign.variables === a.id}
                />
              );
            })
          )}
          {presign.error ? (
            <p className="text-destructive text-sm">
              {apiErrorMessage(presign.error)}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
