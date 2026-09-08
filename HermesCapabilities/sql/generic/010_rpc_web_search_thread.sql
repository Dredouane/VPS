-- HermesCapabilities — SQL GÉNÉRIQUE — 010_rpc_web_search_thread.sql
-- Évolution de rpc_web_doc_search (008) : filtre optionnel p_thread_id pour
-- le chat thread-scopé de la webapp (décision architecte D-A/D-C).
-- Namespace rpc_web_* inchangé (webapp, service_role uniquement, pas de
-- secret agent) — cf. DECISIONS HermesWeb/Alinea W9.
-- Signature étendue → drop de l'ancienne signature pour éviter l'overload.

drop function if exists public.rpc_web_doc_search(text, extensions.vector, int, text);

create or replace function public.rpc_web_doc_search(
    p_client_slug     text,
    p_query_embedding extensions.vector,
    p_match_count     int default 5,
    p_kind            text default null,
    p_thread_id       text default null
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
      and (p_thread_id is null or d.thread_id = p_thread_id)
    order by d.embedding <=> p_query_embedding
    limit greatest(1, least(coalesce(p_match_count, 5), 20));
$$;

-- Scellage : exécutable par service_role UNIQUEMENT (la webapp).
revoke all on function public.rpc_web_doc_search(text, extensions.vector, int, text, text)
    from public, anon, authenticated;
grant execute on function public.rpc_web_doc_search(text, extensions.vector, int, text, text)
    to service_role;
