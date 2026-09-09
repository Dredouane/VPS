"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  MessagesSquare,
  Pencil,
  TriangleAlert,
} from "lucide-react";

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
import { Separator } from "@alinea/ui/components/separator";
import { StatutFactureBadge } from "@alinea/ui/components/statut-facture-badge";
import {
  FACTURE_STATUT_LABELS,
  formatMontant,
} from "@alinea/ui/lib/statut-labels";

import { api, apiErrorMessage, queryKeys } from "@/lib/api-client";
import { ChatPanel } from "@/components/chat-panel";

type Facture = Record<string, any>;

const EDITABLE = [
  "date_facture",
  "date_echeance",
  "montant_ht",
  "montant_tva",
  "montant_ttc",
  "objet",
  "fournisseur",
  "fournisseur_identifiant",
  "devise",
] as const;

const LABELS: Record<string, string> = {
  fournisseur: "Fournisseur",
  fournisseur_identifiant: "Identifiant fournisseur (SIRET/TVA)",
  objet: "Objet",
  date_facture: "Date de facture",
  date_echeance: "Échéance",
  montant_ht: "Montant HT",
  montant_tva: "TVA",
  montant_ttc: "Montant TTC",
  devise: "Devise",
};

function Row({
  label,
  value,
  missing,
  editing,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  missing?: boolean;
  editing?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      {editing ? (
        <div className="w-52">{children}</div>
      ) : (
        <span
          className={
            missing
              ? "text-warning inline-flex items-center gap-1 text-sm font-medium"
              : "text-sm font-medium"
          }
        >
          {missing ? <TriangleAlert className="size-3.5" /> : null}
          {value ?? "à compléter"}
        </span>
      )}
    </div>
  );
}

function confianceExpliquee(confiance: number | null | undefined): string {
  if (confiance == null) return "Indice indisponible — vérifiez la pièce jointe.";
  const pct = Math.round(confiance * 100);
  if (pct >= 90) return `${pct} % — lecture nette, contrôle rapide suffisant.`;
  if (pct >= 80) return `${pct} % — bonne lecture, un contrôle des montants est conseillé.`;
  return `${pct} % — lecture dégradée ou champs manquants : vérifiez la pièce jointe avant de valider.`;
}

export default function FactureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const facture = useQuery({
    queryKey: queryKeys.facture(id),
    queryFn: () => api.GET("/api/v1/factures/{id}", { params: { path: { id } } }),
  });

  const f = facture.data?.data;

  // Provenance : mail d'origine → thread
  const sourceMail = useQuery({
    queryKey: ["facture-source", f?.email_message_id],
    enabled: !!f?.email_message_id,
    queryFn: () =>
      api.GET("/api/v1/emails", {
        params: { query: { message_id: f!.email_message_id!, limit: 1, offset: 0 } },
      }),
  });
  const threadId = sourceMail.data?.data?.items?.[0]?.thread_id ?? null;

  const saveTransition = useMutation({
    mutationFn: (statut: "valide" | "rejete") =>
      api.PATCH("/api/v1/factures/{id}", {
        params: { path: { id } },
        body: { statut },
      }),
    onSuccess: (res) => {
      if (res.data) queryClient.setQueryData(queryKeys.facture(id), { data: res.data });
      queryClient.invalidateQueries({ queryKey: ["factures"] });
    },
  });

  const saveCorrection = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api.PATCH("/api/v1/factures/{id}", {
        params: { path: { id } },
        body: patch,
      }),
    onSuccess: (res) => {
      if (res.data) queryClient.setQueryData(queryKeys.facture(id), { data: res.data });
      queryClient.invalidateQueries({ queryKey: ["factures"] });
      setEditing(false);
      setForm({});
    },
  });

  const presignPdf = useMutation({
    mutationFn: (documentId: string) =>
      api.GET("/api/v1/files/{documentId}", { params: { path: { documentId } } }),
    onSuccess: (res) => {
      if (res.data?.url) window.open(res.data.url, "_blank", "noopener");
    },
  });

  const err = (facture.error ?? saveTransition.error ?? saveCorrection.error ?? presignPdf.error) as
    | { error?: { message?: string } }
    | undefined;

  if (facture.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-10 w-1/2 animate-pulse rounded-md bg-accent" />
        <div className="h-64 animate-pulse rounded-md bg-accent" />
      </div>
    );
  }
  if (err && !f) {
    return <p className="text-destructive text-sm">{err.error?.message}</p>;
  }
  if (!f) return null;

  // Audit défensif : tolère le format legacy wrappé ({audit:{push:…}}) et
  // ignore les entrées sans changes valides — le front ne crash jamais sur
  // une donnée historique.
  function normalizeAuditEntries(raw: unknown) {
    if (!Array.isArray(raw)) return [];
    const entries: { at: string; by: string; changes: Record<string, { from: unknown; to: unknown }> }[] = [];
    for (const candidate of raw) {
      const e =
        candidate && typeof candidate === "object" &&
        "audit" in candidate &&
        (candidate as { audit?: { push?: unknown } }).audit?.push
          ? (candidate as { audit: { push: unknown } }).audit.push
          : candidate;
      if (
        e && typeof e === "object" &&
        typeof (e as { at?: unknown }).at === "string" &&
        typeof (e as { by?: unknown }).by === "string" &&
        (e as { changes?: unknown }).changes &&
        typeof (e as { changes: unknown }).changes === "object"
      ) {
        entries.push(e as { at: string; by: string; changes: Record<string, { from: unknown; to: unknown }> });
      }
    }
    return entries;
  }
  const extraction = (f.extraction ?? {}) as Record<string, unknown>;
  const audit = normalizeAuditEntries(extraction.audit);
  const aTraiter = f.statut === "extracted";
  const editField = (name: string, value: string) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  function startEdit() {
    const init: Record<string, string> = {};
    for (const field of EDITABLE) init[field] = f![field] == null ? "" : String(f![field]);
    setForm(init);
    setEditing(true);
  }

  function saveEdit() {
    const patch: Record<string, unknown> = {};
    for (const field of EDITABLE) {
      if (field in form && form[field] !== String(f![field] ?? "")) {
        patch[field] = form[field] === "" ? null : form[field];
      }
    }
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    saveCorrection.mutate(patch);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Facture ${f.numero}`}
        description={f.fournisseur || undefined}
        actions={
          <>
            <StatutFactureBadge statut={f.statut} />
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="size-4" />
              Retour à la liste
            </Button>
          </>
        }
      />

      {err ? <p className="text-destructive text-sm">{err.error?.message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Zone A — données */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Détails de la facture</CardTitle>
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={saveCorrection.isPending}>
                  {saveCorrection.isPending ? "…" : "Enregistrer"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setForm({});
                  }}
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil className="size-3.5" />
                Modifier
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col">
            <Row label="Numéro" value={f.numero} />
            <Row label="Fournisseur" value={f.fournisseur || null} missing={!f.fournisseur} editing={editing}>
              <Input value={form.fournisseur ?? ""} onChange={(e) => editField("fournisseur", e.target.value)} />
            </Row>
            <Row
              label={LABELS.fournisseur_identifiant}
              value={f.fournisseur_identifiant || null}
              missing={!f.fournisseur_identifiant}
              editing={editing}
            >
              <Input value={form.fournisseur_identifiant ?? ""} onChange={(e) => editField("fournisseur_identifiant", e.target.value)} />
            </Row>
            <Row label="Objet" value={f.objet ?? null} missing={!f.objet} editing={editing}>
              <Input value={form.objet ?? ""} onChange={(e) => editField("objet", e.target.value)} />
            </Row>
            <Separator className="my-2" />
            <Row label="Date de facture" value={f.date_facture ?? null} missing={!f.date_facture} editing={editing}>
              <Input type="date" value={form.date_facture ?? ""} onChange={(e) => editField("date_facture", e.target.value)} />
            </Row>
            <Row label="Échéance" value={f.date_echeance ?? null} missing={!f.date_echeance} editing={editing}>
              <Input type="date" value={form.date_echeance ?? ""} onChange={(e) => editField("date_echeance", e.target.value)} />
            </Row>
            <Separator className="my-2" />
            <Row label="Montant HT" value={formatMontant(f.montant_ht, f.devise)} editing={editing}>
              <Input type="number" step="0.01" value={form.montant_ht ?? ""} onChange={(e) => editField("montant_ht", e.target.value)} />
            </Row>
            <Row label="TVA" value={formatMontant(f.montant_tva, f.devise)} editing={editing}>
              <Input type="number" step="0.01" value={form.montant_tva ?? ""} onChange={(e) => editField("montant_tva", e.target.value)} />
            </Row>
            <Row label="Montant TTC" value={formatMontant(f.montant_ttc, f.devise)} editing={editing}>
              <Input type="number" step="0.01" value={form.montant_ttc ?? ""} onChange={(e) => editField("montant_ttc", e.target.value)} />
            </Row>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {/* Confiance expliquée */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Fiabilité de l'extraction</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {confianceExpliquee(f.confiance ?? null)}
              </p>
              {f.document_id ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  disabled={presignPdf.isPending}
                  onClick={() => presignPdf.mutate(f.document_id!)}
                >
                  <ExternalLink className="size-3.5" />
                  Ouvrir la pièce jointe d'origine
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {/* Zone B — provenance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">D'où vient cette facture ?</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">
                Extraite automatiquement depuis l'échange email ci-dessous.
              </p>
              {threadId ? (
                <Link
                  href={`/chains/${encodeURIComponent(threadId)}`}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 transition-colors hover:bg-accent"
                >
                  <Mail className="size-4" />
                  <span className="text-sm font-medium">Voir la conversation d'origine</span>
                </Link>
              ) : (
                <p className="text-muted-foreground">
                  L'email d'origine n'est pas encore relié à cette fiche.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Actions (TKT-204) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Décision</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {aTraiter ? (
                <div className="flex gap-2">
                  <Button onClick={() => saveTransition.mutate("valide")} disabled={saveTransition.isPending}>
                    {saveTransition.isPending ? "…" : "Valider"}
                  </Button>
                  <Button variant="destructive" onClick={() => saveTransition.mutate("rejete")} disabled={saveTransition.isPending}>
                    Rejeter
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">
                    Statut : <strong>{FACTURE_STATUT_LABELS[f.statut] ?? f.statut}</strong>
                    {f.statut === "rejete" ? " — vous pouvez la repasser en validée si c'était une erreur." : ""}
                  </p>
                  {f.statut === "rejete" ? (
                    <Button size="sm" variant="outline" onClick={() => saveTransition.mutate("valide")} disabled={saveTransition.isPending}>
                      Valider finalement
                    </Button>
                  ) : null}
                </>
              )}
              <Link href="/factures" className="text-muted-foreground text-xs underline-offset-4 hover:underline">
                ← Retour à la liste des factures
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Zone C — assistant expert (TKT-203) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessagesSquare className="size-4" />
            Questions sur cette facture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChatPanel
            scope={{ type: "facture", id }}
            title=""
            intro="L'assistant connaît cette fiche et les documents liés (isolation par facture)."
            suggestions={[
              "Cette facture correspond à quel email ?",
              "Quel est le montant total ?",
              "Que contient la pièce jointe ?",
            ]}
          />
        </CardContent>
      </Card>

      {/* Audit des corrections */}
      {audit.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Corrections ({audit.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5 text-xs">
            {audit
              .slice()
              .reverse()
              .map((a, i) => (
                <div key={i} className="text-muted-foreground">
                  {new Date(a.at).toLocaleString("fr-FR")} — {a.by} :{" "}
                  {Object.entries(a.changes)
                    .map(
                      ([field, ch]) =>
                        `${LABELS[field] ?? field} : « ${String(ch.from ?? "—")} » → « ${String(ch.to ?? "—")} »`
                    )
                    .join(" · ")}
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
