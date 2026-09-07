"use client";

import createClient from "openapi-fetch";
import type {
  components,
  paths,
} from "@hermesweb/api-types/schema";

/** Client API typé par le contrat généré (same-origin, cookies de session). */
export const api = createClient<paths>({ baseUrl: "" });

export type Facture = components["schemas"]["Facture"];
export type FactureUpdate = components["schemas"]["FactureUpdate"];
export type Email = components["schemas"]["Email"];
export type EmailChain = components["schemas"]["EmailChain"];
export type Document = components["schemas"]["Document"];
export type PipelineRun = components["schemas"]["PipelineRun"];
export type Me = components["schemas"]["Me"];
export type Client = components["schemas"]["Client"];
export type AppUser = components["schemas"]["AppUser"];
export type DocumentSearchResult =
  components["schemas"]["DocumentSearchResult"];

export const queryKeys = {
  me: ["me"] as const,
  factures: (filters: { statut?: string; limit: number; offset: number }) =>
    ["factures", filters] as const,
  facture: (id: string) => ["facture", id] as const,
  emails: (filters: { status?: string; limit: number; offset: number }) =>
    ["emails", filters] as const,
  chains: (filters: { limit: number; offset: number }) =>
    ["chains", filters] as const,
  runs: (filters: { limit: number; offset: number }) =>
    ["runs", filters] as const,
  clients: ["admin", "clients"] as const,
  appUsers: ["admin", "users"] as const,
};

/** Message d'erreur lisible depuis l'enveloppe contractuelle. */
export function apiErrorMessage(err: unknown): string {
  const e = err as { error?: { message?: string; code?: string }; message?: string };
  return e?.error?.message ?? e?.message ?? "Erreur inconnue";
}
