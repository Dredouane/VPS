import type { OpenApiConfig } from "../scripts/lib/types";

/**
 * Configuration du contrat API HermesWeb.
 *
 * - Les schémas Row/Insert/Update sont DÉRIVÉS du SQL (source de vérité) ;
 * - Ici on déclare : quelles tables sont exposées, les colonnes exclues
 *   (internes / secrets), et le manifest des opérations ;
 * - `openapi/openapi.yaml` est 100 % généré depuis ce fichier + le SQL.
 */

const LIMIT_PARAM = {
  name: "limit",
  schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
  description: "Taille de page (max 200).",
} as const;

const OFFSET_PARAM = {
  name: "offset",
  schema: { type: "integer", minimum: 0, default: 0 },
  description: "Offset de pagination.",
} as const;

export const openApiConfig: OpenApiConfig = {
  info: {
    title: "Hermes Web API",
    version: "0.1.0",
    description:
      "API du backoffice clients PME (HermesFleet). Données : projet Supabase " +
      "multi-tenant (tables cap_*, slug = client). Auth : session Supabase. " +
      "GÉNÉRÉ depuis HermesCapabilities/sql/generic — ne pas éditer le YAML.",
  },
  sqlDir: "HermesCapabilities/sql/generic",
  resources: [
    {
      table: "cap_factures",
      name: "Facture",
      variants: { update: true },
    },
    { table: "cap_emails", name: "Email" },
    { table: "cap_email_chains", name: "EmailChain" },
    {
      table: "cap_documents",
      name: "Document",
      excludeColumns: ["embedding"],
    },
    { table: "cap_pipeline_runs", name: "PipelineRun" },
    {
      table: "cap_clients",
      name: "Client",
      excludeColumns: ["rpc_secret"],
    },
    {
      table: "app_users",
      name: "AppUser",
      variants: { insert: true },
    },
  ],
  operations: [
    {
      method: "get",
      path: "/api/v1/me",
      operationId: "getMe",
      tag: "auth",
      summary: "Utilisateur connecté : rôle + client",
      responseSchema: "Me",
    },
    // ── Factures (D6 : validation humaine = transitions de statut) ──
    {
      method: "get",
      path: "/api/v1/factures",
      operationId: "listFactures",
      tag: "factures",
      summary: "Liste paginée des factures du client",
      listOf: "Facture",
      queryParams: [
        {
          name: "statut",
          schema: {
            type: "string",
            enum: ["extracted", "valide", "rejete", "paye", "archive"],
          },
          description: "Filtre par statut.",
        },
        LIMIT_PARAM,
        OFFSET_PARAM,
      ],
    },
    {
      method: "get",
      path: "/api/v1/factures/{id}",
      operationId: "getFacture",
      tag: "factures",
      summary: "Détail d'une facture",
      responseSchema: "Facture",
      pathParams: { id: "uuid" },
    },
    {
      method: "patch",
      path: "/api/v1/factures/{id}",
      operationId: "updateFacture",
      tag: "factures",
      summary: "Transition de statut (validation humaine)",
      description:
        "D6 : la validation humaine = transition de statut. extracted → " +
        "valide | rejete ; rejets/validations ultérieurs conformes aux CHECK SQL.",
      responseSchema: "Facture",
      bodySchema: "FactureUpdate",
      pathParams: { id: "uuid" },
    },
    // ── Emails ──
    {
      method: "get",
      path: "/api/v1/emails",
      operationId: "listEmails",
      tag: "emails",
      summary: "Liste paginée des emails traités",
      listOf: "Email",
      queryParams: [
        {
          name: "status",
          schema: {
            type: "string",
            enum: ["received", "processed", "error"],
          },
          description: "Filtre par statut de traitement.",
        },
        LIMIT_PARAM,
        OFFSET_PARAM,
      ],
    },
    {
      method: "get",
      path: "/api/v1/emails/{id}",
      operationId: "getEmail",
      tag: "emails",
      summary: "Détail d'un email",
      responseSchema: "Email",
      pathParams: { id: "uuid" },
    },
    // ── Chaînes d'emails ──
    {
      method: "get",
      path: "/api/v1/chains",
      operationId: "listChains",
      tag: "emails",
      summary: "Liste paginée des chaînes (threads Gmail)",
      listOf: "EmailChain",
      queryParams: [LIMIT_PARAM, OFFSET_PARAM],
    },
    // ── Documents (RAG / GED) ──
    {
      method: "get",
      path: "/api/v1/documents",
      operationId: "listDocuments",
      tag: "documents",
      summary: "Liste paginée des documents indexés",
      listOf: "Document",
      queryParams: [
        { name: "thread_id", schema: { type: "string" }, description: "Filtre par thread Gmail." },
        LIMIT_PARAM,
        OFFSET_PARAM,
      ],
    },
    {
      method: "post",
      path: "/api/v1/documents/search",
      operationId: "searchDocuments",
      tag: "documents",
      summary: "Recherche sémantique RAG",
      description:
        "Embedding de la requête (text-embedding-004, 768d — D5) côté serveur " +
        "puis rpc_cap_doc_search. similarité = 1 - distance cosinus.",
      responseSchema: "DocumentSearchResults",
      bodySchema: "DocumentSearchRequest",
    },
    // ── Pipeline runs (D11 : consultation) ──
    {
      method: "get",
      path: "/api/v1/runs",
      operationId: "listRuns",
      tag: "runs",
      summary: "Historique des runs du pipeline email",
      listOf: "PipelineRun",
      queryParams: [LIMIT_PARAM, OFFSET_PARAM],
    },
    // ── Fichiers (GED R2, URLs signées) ──
    {
      method: "get",
      path: "/api/v1/files/{documentId}",
      operationId: "getFileUrl",
      tag: "files",
      summary: "URL signée R2 pour un document archivé",
      responseSchema: "PresignedFile",
      pathParams: { documentId: "uuid" },
    },
    // ── Admin ──
    {
      method: "get",
      path: "/api/v1/admin/clients",
      operationId: "listClients",
      tag: "admin",
      summary: "Registry clients",
      listOf: "Client",
      queryParams: [LIMIT_PARAM, OFFSET_PARAM],
    },
    {
      method: "get",
      path: "/api/v1/admin/users",
      operationId: "listAppUsers",
      tag: "admin",
      summary: "Utilisateurs webapp",
      listOf: "AppUser",
      queryParams: [LIMIT_PARAM, OFFSET_PARAM],
    },
    {
      method: "post",
      path: "/api/v1/admin/users",
      operationId: "createAppUser",
      tag: "admin",
      summary: "Créer un utilisateur webapp",
      responseSchema: "AppUser",
      bodySchema: "AppUserInsert",
    },
    {
      method: "delete",
      path: "/api/v1/admin/users/{userId}",
      operationId: "deleteAppUser",
      tag: "admin",
      summary: "Supprimer un utilisateur webapp",
      successStatus: 204,
      pathParams: { userId: "uuid" },
    },
  ],
  extraSchemas: {
    uuid: { type: "string", format: "uuid" },
    Error: {
      type: "object",
      additionalProperties: false,
      properties: {
        error: {
          type: "object",
          additionalProperties: false,
          properties: {
            code: { type: "string" },
            message: { type: "string" },
          },
          required: ["code", "message"],
        },
      },
      required: ["error"],
    },
    Me: {
      type: "object",
      additionalProperties: false,
      properties: {
        user_id: { type: "string", format: "uuid" },
        email: { type: "string", format: "email" },
        role: { type: "string", enum: ["admin", "backoffice", "terrain"] },
        client_slug: { type: "string" },
        client_nom: { type: "string", description: "Nom du client (registry)." },
        actif: { type: "boolean" },
      },
      required: ["user_id", "email", "role", "client_slug", "actif"],
    },
    DocumentSearchRequest: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string", minLength: 1, description: "Texte de recherche." },
        match_count: {
          type: "integer",
          minimum: 1,
          maximum: 20,
          default: 5,
          description: "Nombre max de résultats (borne rpc_cap_doc_search).",
        },
        kind: { type: "string", enum: ["email", "attachment"] },
      },
      required: ["query"],
    },
    DocumentSearchResults: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: { $ref: "#/components/schemas/DocumentSearchResult" },
        },
      },
      required: ["items"],
    },
    DocumentSearchResult: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", format: "uuid" },
        kind: { type: "string", enum: ["email", "attachment"] },
        title: { type: ["string", "null"] },
        content: { type: "string" },
        metadata: { type: "object", description: "JSON libre." },
        similarity: {
          type: "number",
          description: "1 - distance cosinus (0..1).",
        },
      },
      required: ["id", "kind", "content", "metadata", "similarity"],
    },
    PresignedFile: {
      type: "object",
      additionalProperties: false,
      properties: {
        url: { type: "string", format: "uri", description: "URL signée R2 (GET)." },
        expires_at: {
          type: "string",
          format: "date-time",
          description: "Expiration de l'URL (TTL court).",
        },
      },
      required: ["url", "expires_at"],
    },
  },
};
