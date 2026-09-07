-- HermesCapabilities — SQL GÉNÉRIQUE — 008_rpc_web_search.sql
-- Lecteur webapp pour la recherche RAG (conception webapp, D7 revue 01/09) :
-- les RPC génériques rpc_cap_* exigent (slug, rpc_secret) — c'est le modèle
-- AGENT. La webapp, elle, opère en service key (D8-v3) et n'a PAS les secrets
-- agents. Cette RPC webapp ne prend PAS de secret : elle est scellée par son
-- GRANT — exécutable par service_role UNIQUEMENT (jamais anon/authenticated).
-- RLS deny-all inchangée : la webapp ne lit toujours pas les tables direct
-- pour la recherche vectorielle (opérateur <=> indisponible via PostgREST).

-- Nettoyage : v1 scellée sous le namespace agent (rpc_cap_*) — comptée à tort
-- comme per-slug par le post-check du runner. Remplacée par rpc_web_*.
drop function if exists public.rpc_cap_web_doc_search(text, extensions.vector, int, text);

create or replace function public.rpc_web_doc_search(
    p_client_slug     text,
    p_query_embedding extensions.vector,
    p_match_count     int default 5,
    p_kind            text default null
)
returns table (
    id         uuid,
    kind       text,
    title      text,
    content    text,
    metadata   jsonb,
    similarity float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
    select d.id,
           d.kind,
           d.title,
           d.content,
           d.metadata,
           (1 - (d.embedding <=> p_query_embedding))::float as similarity
    from public.cap_documents d
    where d.client_slug = p_client_slug
      and d.embedding is not null
      and (p_kind is null or d.kind = p_kind)
    order by d.embedding <=> p_query_embedding
    limit greatest(1, least(coalesce(p_match_count, 5), 20));
$$;

-- Scellage : exécutable par service_role UNIQUEMENT (la webapp).
revoke all on function public.rpc_web_doc_search(text, extensions.vector, int, text)
    from public, anon, authenticated;
grant execute on function public.rpc_web_doc_search(text, extensions.vector, int, text)
    to service_role;
