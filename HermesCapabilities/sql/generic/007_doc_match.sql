-- HermesCapabilities — SQL GÉNÉRIQUE — 007_doc_match.sql
-- Recherche sémantique pgvector thread-scopée (pattern Supabase officiel).
-- La webapp backend fait l'embed des questions par elle-même (768d,
-- gemini-embedding-001 — contrat D5) puis appelle cette fonction.
-- La pipeline n'a AUCUN rôle au moment du chat.

create or replace function public.rpc_cap_doc_match(
    p_client_slug text, p_rpc_secret text,
    p_query_embedding extensions.vector,
    p_match_count int default 5,
    p_thread_id text default null
) returns table (id uuid, kind text, title text, content text,
                 metadata jsonb, similarity float)
language sql stable security definer
set search_path = public, extensions
as $$
    select d.id, d.kind, d.title, d.content, d.metadata,
           1 - (d.embedding <=> p_query_embedding) as similarity
    from public.cap_documents d
    where d.client_slug = public.cap_auth_client(p_client_slug, p_rpc_secret)
      and (p_thread_id is null or d.thread_id = btrim(p_thread_id))
      and d.embedding is not null
    order by d.embedding <=> p_query_embedding
    limit greatest(1, least(coalesce(p_match_count, 5), 20));
$$;

grant execute on function public.rpc_cap_doc_match(text, text, extensions.vector, int, text) to anon, authenticated;
