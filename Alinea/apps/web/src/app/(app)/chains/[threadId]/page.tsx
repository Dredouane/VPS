"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Inbox,
  Paperclip,
  Users,
} from "lucide-react";

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
import { StatutFactureBadge } from "@alinea/ui/components/statut-facture-badge";

import { api, apiErrorMessage, queryKeys } from "@/lib/api-client";
import { normalizeParticipants, docMetadata } from "@/lib/chains";
import { ChatBubble } from "@/components/chat-bubble";

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

const ROLE_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  nouveau: "default",
  reponse: "secondary",
  transfert: "outline",
};

export default function ChainDetailPage() {
  const { threadId } = useParams<{ threadId: string }>();
  const router = useRouter();
  const presign = usePresign();

  const detail = useQuery({
    queryKey: [...queryKeys.chains({ limit: 1, offset: 0 }), "detail", threadId],
    queryFn: () =>
      api.GET("/api/v1/chains/{threadId}", {
        params: { path: { threadId } },
      }),
  });

  const d = detail.data?.data;
  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 w-2/3 animate-pulse rounded-md bg-accent" />
        <div className="h-64 animate-pulse rounded-md bg-accent" />
      </div>
    );
  }
  if (detail.error) {
    return (
      <p className="text-destructive text-sm">{apiErrorMessage(detail.error)}</p>
    );
  }
  if (!d) return null;

  const participants = normalizeParticipants(d.chain.participants);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={d.chain.subject ?? "(sans sujet)"}
        description={`${d.mails.length} message${d.mails.length > 1 ? "s" : ""}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="size-4" />
            Retour
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Colonne droite (desktop) — En résumé */}
        <aside className="order-1 flex flex-col gap-4 lg:col-start-3 lg:sticky lg:top-20 lg:self-start">
          <Card className="lg:sticky lg:top-20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">En résumé</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Messages</span>
                <span>{d.mails.length}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Dernier échange</span>
                <span>
                  {d.chain.last_message_at
                    ? new Date(d.chain.last_message_at).toLocaleDateString("fr-FR")
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Factures liées</span>
                <span>
                  {d.factures.length > 0 ? (
                    <Link
                      href={`/factures/${d.factures[0].id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {d.factures[0].numero}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">aucune pour l&apos;instant</span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          Factures liées ({d.factures.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2">
                        {d.factures.length === 0 ? (
                          <EmptyState
                            icon={Inbox}
                            title="Aucune facture liée"
                            description="Aucun expert facturation n'a extrait de facture depuis ce thread."
                          />
                        ) : (
                          d.factures.map((f) => (
                            <Link
                              key={f.id}
                              href={`/factures/${f.id}`}
                              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-accent"
                            >
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate text-sm font-medium">
                                  {f.numero} — {f.fournisseur || "—"}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  {f.montant_ttc != null
                                    ? `${f.montant_ttc.toFixed(2)} ${f.devise}`
                                    : "—"}
                                  {f.date_facture ? ` · ${f.date_facture}` : ""}
                                </span>
                              </div>
                              <StatutFactureBadge statut={f.statut} />
                            </Link>
                          ))
                        )}
                      </CardContent>
                    </Card>
        </aside>



        {/* Colonne large (desktop) — fil des mails */}
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:col-span-2">
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              <span className="[overflow-wrap:anywhere]">
                {participants.length > 0 ? participants.join(", ") : "—"}
              </span>
            </span>
            {d.chain.last_message_at ? (
              <span>
                Dernier :{" "}
                {new Date(d.chain.last_message_at).toLocaleString("fr-FR")}
              </span>
            ) : null}
          </div>

          {d.mails.map((mail) => {
            const role = (mail.email as { thread_role?: string }).thread_role;
            const from = (mail.email as { from_addr?: string }).from_addr;
            const date = (mail.email as { mail_date?: string | null }).mail_date;
            const contentMeta = mail.content ? docMetadata(mail.content.metadata) : {};
            return (
              <Card key={(mail.email as { id: string }).id} className="min-w-0">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                        {(from ?? "?")
                          .replace(/<.*>/, "")
                          .trim()
                          .split(/\s+/)
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase() || "?"}
                      </span>
                      <CardTitle className="truncate text-sm font-medium">
                        {from ?? "—"}
                      </CardTitle>
                      {role ? (
                        <Badge variant={ROLE_BADGE[role] ?? "outline"}>{role}</Badge>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {date ? new Date(date).toLocaleString("fr-FR") : "—"}
                      </span>
                      {mail.content && contentMeta.r2_key ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          disabled={presign.isPending}
                          onClick={() =>
                            presign.mutate((mail.content as { id: string }).id)
                          }
                        >
                          <ExternalLink className="size-3.5" />
                          Voir l&apos;email brut
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {mail.content ? (
                    <p className="max-h-96 overflow-y-auto text-sm leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
                      {mail.content.content}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm italic">
                      Contenu non indexé pour ce message.
                    </p>
                  )}

                  {mail.attachments.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {mail.attachments.map((a) => {
                        const ameta = docMetadata(a.metadata) as {
                          r2_key?: string;
                          filename?: string;
                        };
                        return (
                          <div
                            key={a.id}
                            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Paperclip className="text-muted-foreground size-4 shrink-0" />
                              <span className="truncate text-sm">
                                {ameta.filename ?? a.title ?? a.id.slice(0, 8)}
                              </span>
                              {ameta.r2_key ? null : (
                                <span className="text-muted-foreground text-xs">
                                  (brut indisponible)
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!ameta.r2_key || presign.isPending}
                              onClick={() => presign.mutate(a.id)}
                            >
                              <ExternalLink className="size-3.5" />
                              Ouvrir
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>


      </div>

      <ChatBubble
        scope={{ type: "chain", id: threadId }}
        title="Assistant de la conversation"
        intro="Répond à partir de cet échange uniquement — sources citées."
        suggestions={[
          "Résume cette conversation",
          "De quoi parle cet échange ?",
          "Quelles pièces jointes ont été échangées ?",
        ]}
      />
    </div>
  );
}
