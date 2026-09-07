/**
 * Types partagés du pipeline contrats (générateur SQL → OpenAPI).
 * Source de vérité des données : HermesCapabilities/sql/generic/*.sql (D9).
 * Le YAML openapi/openapi.yaml est une VUE GÉNÉRÉE du SQL — ne jamais l'éditer.
 */

/** Colonne SQL parsée. */
export interface SqlColumn {
  name: string;
  /** Type PostgreSQL brut tel qu'écrit (ex: numeric(12,2), extensions.vector(768)). */
  pgType: string;
  nullable: boolean;
  hasDefault: boolean;
  /** Valeurs d'un CHECK `col in ('a','b')` — null si pas d'énumération. */
  enumValues: string[] | null;
  /** Commentaire SQL inline (--) si présent. */
  description: string | null;
}

/** Table SQL parsée. */
export interface SqlTable {
  name: string;
  columns: SqlColumn[];
}

/** Ressource API exposée depuis une table SQL. */
export interface ResourceConfig {
  /** Nom de la table SQL (ex: cap_factures). */
  table: string;
  /** Nom du schéma OpenAPI pour la ligne (ex: Facture). */
  name: string;
  /** Colonnes exclues du contrat API (internes / secrets). */
  excludeColumns?: string[];
  /** Variantes générées — défaut : row uniquement. */
  variants?: {
    insert?: boolean;
    update?: boolean;
  };
}

/** Entrée du manifest des opérations API. */
export interface OperationConfig {
  method: "get" | "post" | "patch" | "delete" | "put";
  path: string;
  operationId: string;
  tag: string;
  summary: string;
  description?: string;
  /** Nom de schéma du body (composant généré ou extra). */
  bodySchema?: string;
  /** Nom de schéma de la réponse 200 (ou 201 si post). */
  responseSchema?: string;
  /** La réponse 200 est une liste paginée du schéma donné (génère <X>List). */
  listOf?: string;
  /** Paramètre path (nom → schéma extra, ex: uuid). */
  pathParams?: Record<string, string>;
  /** Paramètres query nommés (schémas extra définis dans extraSchemas/params). */
  queryParams?: QueryParamConfig[];
  successStatus?: 200 | 201 | 204;
}

export interface QueryParamConfig {
  name: string;
  schema: QueryParamSchema;
  description?: string;
}

export type QueryParamSchema =
  | { type: "string"; enum?: string[] }
  | { type: "integer"; minimum?: number; maximum?: number; default?: number };

/** Schémas OpenAPI hors-SQL (main dans la config — stables). */
export type ExtraSchema = Record<string, unknown>;

/** Configuration complète du contrat API. */
export interface OpenApiConfig {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  /** Chemin du dossier SQL source (relatif à la racine du repo VPS). */
  sqlDir: string;
  resources: ResourceConfig[];
  operations: OperationConfig[];
  extraSchemas: Record<string, ExtraSchema>;
}
