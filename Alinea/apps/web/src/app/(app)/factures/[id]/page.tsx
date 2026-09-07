"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@alinea/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@alinea/ui/components/card";
import { Separator } from "@alinea/ui/components/separator";
import { StatutFactureBadge } from "@alinea/ui/components/statut-facture-badge";

import { api, apiErrorMessage, queryKeys } from "@/lib/api-client";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function FactureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const facture = useQuery({
    queryKey: queryKeys.facture(id),
    queryFn: () => api.GET("/api/v1/factures/{id}", { params: { path: { id } } }),
  });

  const transition = useMutation({
    mutationFn: (statut: "valide" | "rejete") =>
      api.PATCH("/api/v1/factures/{id}", {
        params: { path: { id } },
        body: { statut },
      }),
    onSuccess: (res) => {
      if (res.data) {
        queryClient.setQueryData(queryKeys.facture(id), { data: res.data });
      }
      queryClient.invalidateQueries({ queryKey: ["factures"] });
    },
  });

  const f = facture.data?.data;
  const err = (facture.error ?? transition.error) as
    | { error?: { message?: string } }
    | undefined;

  if (facture.isLoading) {
    return <p className="text-muted-foreground text-sm">Chargement…</p>;
  }
  if (err) {
    return <p className="text-destructive text-sm">{err.error?.message}</p>;
  }
  if (!f) return null;

  const modifiable = f.statut === "extracted" || f.statut === "rejete";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{f.numero}</h1>
          <p className="text-muted-foreground text-sm">{f.fournisseur || "—"}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatutFactureBadge statut={f.statut} />
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Retour
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            <Row label="Fournisseur" value={f.fournisseur || "—"} />
            <Row label="Identifiant fourn." value={f.fournisseur_identifiant ?? "—"} />
            <Row label="Objet" value={f.objet ?? "—"} />
            <Separator className="my-2" />
            <Row label="Date facture" value={f.date_facture ?? "—"} />
            <Row label="Échéance" value={f.date_echeance ?? "—"} />
            <Separator className="my-2" />
            <Row label="HT" value={f.montant_ht != null ? `${f.montant_ht.toFixed(2)} ${f.devise}` : "—"} />
            <Row label="TVA" value={f.montant_tva != null ? `${f.montant_tva.toFixed(2)} ${f.devise}` : "—"} />
            <Row label="TTC" value={f.montant_ttc != null ? `${f.montant_ttc.toFixed(2)} ${f.devise}` : "—"} />
            <Separator className="my-2" />
            <Row label="Email source" value={f.email_message_id ?? "—"} />
            <Row
              label="Confiance extraction"
              value={f.confiance != null ? `${Math.round(f.confiance * 100)} %` : "—"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Validation humaine (D6)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              L&apos;extraction automatique écrit avec le statut
              <code className="mx-1">extracted</code>— la validation humaine est
              une transition de statut.
            </p>
            {modifiable ? (
              <div className="flex gap-2">
                <Button
                  onClick={() => transition.mutate("valide")}
                  disabled={transition.isPending}
                >
                  {transition.isPending ? "…" : "Valider"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => transition.mutate("rejete")}
                  disabled={transition.isPending}
                >
                  Rejeter
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Statut <code>{f.statut}</code> — pas de transition disponible
                ici.
              </p>
            )}
            {err ? <p className="text-destructive text-sm">{apiErrorMessage(err)}</p> : null}
            <Separator className="my-2" />
            <p className="text-muted-foreground text-xs">
              Extraction brute :{" "}
              <Link
                href={`/emails`}
                className="underline-offset-4 hover:underline"
              >
                consulter les emails du fil
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
