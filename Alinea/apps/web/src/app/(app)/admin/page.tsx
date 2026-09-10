"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@alinea/ui/components/badge";
import { Button } from "@alinea/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@alinea/ui/components/card";
import { PageHeader } from "@alinea/ui/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@alinea/ui/components/table";

import { api, apiErrorMessage, queryKeys } from "@/lib/api-client";

export default function AdminPage() {
  const queryClient = useQueryClient();

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.GET("/api/v1/me"),
  });
  const clients = useQuery({
    queryKey: queryKeys.clients,
    queryFn: () => api.GET("/api/v1/admin/clients", { params: { query: { limit: 50, offset: 0 } } }),
  });
  const users = useQuery({
    queryKey: queryKeys.appUsers,
    queryFn: () => api.GET("/api/v1/admin/users", { params: { query: { limit: 50, offset: 0 } } }),
  });

  const removeUser = useMutation({
    mutationFn: (userId: string) =>
      api.DELETE("/api/v1/admin/users/{userId}", {
        params: { path: { userId } },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.appUsers }),
  });

  const role = me.data?.data?.role;
  const err = (clients.error ?? users.error ?? me.error) as
    | { error?: { message?: string } }
    | undefined;

  if (me.isLoading) {
    return <p className="text-muted-foreground text-sm">Chargement…</p>;
  }
  if (role !== "admin") {
    return (
      <p className="text-muted-foreground text-sm">
        Accès réservé au rôle <code>admin</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Administration"
        description="Gestion des clients et des accès."
      />

      {err ? <p className="text-destructive text-sm">{err.error?.message}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clients</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Référent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(clients.data?.data?.items ?? []).map((c) => (
                <TableRow key={c.slug}>
                  <TableCell className="font-medium">{c.slug}</TableCell>
                  <TableCell>{c.nom}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        c.statut === "active"
                          ? "success"
                          : c.statut === "suspended"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {c.statut}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.referent ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Utilisateurs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Actif</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users.data?.data?.items ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.client_slug}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell>
                    {u.actif ? (
                      <Badge variant="success">actif</Badge>
                    ) : (
                      <Badge variant="secondary">inactif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(u.created_at).toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={removeUser.isPending}
                      onClick={() => {
                        if (confirm(`Supprimer cet accès (${u.client_slug}) ?`)) {
                          removeUser.mutate(u.user_id);
                        }
                      }}
                    >
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(users.data?.data?.items ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Aucun utilisateur.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {removeUser.error ? (
            <p className="text-destructive mt-2 text-sm">
              {apiErrorMessage(removeUser.error)}
            </p>
          ) : null}
          <p className="text-muted-foreground mt-3 text-xs">
            Les comptes se créent depuis l&apos;espace d&apos;administration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
