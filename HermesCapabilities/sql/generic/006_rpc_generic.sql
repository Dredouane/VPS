-- HermesCapabilities — SQL GÉNÉRIQUE — 006_rpc_generic.sql
-- 9 RPC GÉNÉRIQUES (D8-v3, option B) : une seule série pour TOUS les slugs.
-- Signature commune (p_client_slug, p_rpc_secret, …) avec garde d'entrée :
-- le couple doit matcher cap_clients (statut='active') — sinon exception.
-- Le secret vit dans client.env (600) de chaque client — jamais l'inverse.
-- Logique métier identique aux ex-versions arev (dedup md5, bornes search,
-- non-rétrogradation des factures validées).

-- ─────────────────────────────── garde (privée) ──────────────────────────────
create or replace function public.cap_auth_client(p_client_slug text, p_rpc_secret text)
returns text
language plpgsql stable security definer
set search_path = public, extensions
as $$
declare v_slug text;
begin
    if p_client_slug is null or p_rpc_secret is null then
        raise exception 'slug/secret requis';
    end if;
    select slug into v_slug from public.cap_clients
    where slug = btrim(p_client_slug)
      and rpc_secret = btrim(p_rpc_secret)
      and statut = 'active';
    if v_slug is null then
        raise exception 'slug/secret invalide ou client inactif';
    end if;
    return v_slug;
end $$;

-- La garde n'est PAS exécutable directement par les agents (probing interdit)
revoke all on function public.cap_auth_client(text, text) from anon, authenticated;

-- ─────────────────────────────── doc_status ──────────────────────────────────
create or replace function public.rpc_cap_doc_status(
    p_client_slug text, p_rpc_secret text, p_message_ids text[]
) returns table (message_id text, known boolean)
language sql stable security definer
set search_path = public, extensions
as $$
    select m.message_id,
           exists (select 1 from public.cap_documents d
                   where d.client_slug = public.cap_auth_client(p_client_slug, p_rpc_secret)
                     and d.message_id = m.message_id) as known
    from unnest(p_message_ids) as m(message_id);
$$;

-- ─────────────────────────────── doc_upsert ──────────────────────────────────
create or replace function public.rpc_cap_doc_upsert(
    p_client_slug text, p_rpc_secret text,
    p_kind text, p_message_id text, p_content text,
    p_embedding extensions.vector,
    p_thread_id text default null, p_thread_role text default null,
    p_parent_message_id text default null, p_title text default null,
    p_metadata jsonb default '{}'
) returns uuid
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare v_slug text; v_id uuid;
begin
    v_slug := public.cap_auth_client(p_client_slug, p_rpc_secret);
    if p_kind not in ('email', 'attachment') then
        raise exception 'kind invalide: %', p_kind;
    end if;
    if p_embedding is null or vector_dims(p_embedding) <> 768 then
        raise exception 'embedding requis (768d, text-embedding-004)';
    end if;
    insert into public.cap_documents
        (client_slug, kind, message_id, thread_id, thread_role,
         parent_message_id, title, content, content_md5, embedding, metadata)
    values
        (v_slug, p_kind, p_message_id, p_thread_id, p_thread_role,
         p_parent_message_id, p_title, p_content, md5(p_content),
         p_embedding, p_metadata)
    on conflict (client_slug, kind, content_md5) do update
        set embedding = excluded.embedding, metadata = excluded.metadata,
            updated_at = now()
    returning id into v_id;
    return v_id;
end $$;

-- ─────────────────────────────── doc_search ──────────────────────────────────
create or replace function public.rpc_cap_doc_search(
    p_client_slug text, p_rpc_secret text,
    p_query_embedding extensions.vector, p_match_count int default 5,
    p_kind text default null
) returns table (id uuid, kind text, title text, content text,
                 metadata jsonb, similarity float)
language sql stable security definer
set search_path = public, extensions
as $$
    select d.id, d.kind, d.title, d.content, d.metadata,
           1 - (d.embedding <=> p_query_embedding) as similarity
    from public.cap_documents d
    where d.client_slug = public.cap_auth_client(p_client_slug, p_rpc_secret)
      and (p_kind is null or d.kind = p_kind)
      and d.embedding is not null
    order by d.embedding <=> p_query_embedding
    limit greatest(1, least(coalesce(p_match_count, 5), 20));
$$;

-- ─────────────────────────────── email_upsert ────────────────────────────────
create or replace function public.rpc_cap_email_upsert(
    p_client_slug text, p_rpc_secret text,
    p_message_id text, p_thread_id text default null, p_thread_role text default null,
    p_from_addr text default null, p_subject text default null,
    p_mail_date timestamptz default null, p_classification text default null,
    p_resume text default null, p_status text default 'received',
    p_error text default null, p_raw_metadata jsonb default '{}'
) returns uuid
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare v_slug text; v_id uuid;
begin
    v_slug := public.cap_auth_client(p_client_slug, p_rpc_secret);
    if p_status not in ('received', 'processed', 'error') then
        raise exception 'status invalide: %', p_status;
    end if;
    insert into public.cap_emails
        (client_slug, message_id, thread_id, thread_role, from_addr, subject,
         mail_date, classification, resume, status, error, raw_metadata)
    values
        (v_slug, p_message_id, p_thread_id, p_thread_role, p_from_addr,
         p_subject, p_mail_date, p_classification, p_resume, p_status,
         p_error, p_raw_metadata)
    on conflict (client_slug, message_id) do update
        set classification = coalesce(excluded.classification, public.cap_emails.classification),
            resume         = coalesce(excluded.resume, public.cap_emails.resume),
            status         = excluded.status,
            error          = excluded.error,
            raw_metadata   = excluded.raw_metadata,
            attempts       = public.cap_emails.attempts
                             + (case when excluded.status = 'error' then 1 else 0 end),
            updated_at     = now()
    returning id into v_id;
    return v_id;
end $$;

-- ─────────────────────────────── chain_upsert ────────────────────────────────
create or replace function public.rpc_cap_chain_upsert(
    p_client_slug text, p_rpc_secret text,
    p_thread_id text, p_subject text default null,
    p_participants jsonb default '[]', p_messages_count int default 0,
    p_first_message_at timestamptz default null,
    p_last_message_at timestamptz default null
) returns table (id uuid, action text)
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare v_slug text; v_id uuid;
begin
    v_slug := public.cap_auth_client(p_client_slug, p_rpc_secret);
    if p_thread_id is null or btrim(p_thread_id) = '' then
        raise exception 'thread_id requis';
    end if;
    insert into public.cap_email_chains AS c
        (client_slug, thread_id, subject, participants,
         messages_count, first_message_at, last_message_at)
    values
        (v_slug, btrim(p_thread_id), p_subject, p_participants,
         greatest(coalesce(p_messages_count, 0), 0),
         p_first_message_at, p_last_message_at)
    on conflict (client_slug, thread_id) do update
        set subject          = coalesce(excluded.subject, c.subject),
            participants     = case when excluded.participants <> '[]'::jsonb
                                    then excluded.participants else c.participants end,
            messages_count   = greatest(c.messages_count, excluded.messages_count),
            first_message_at = least(coalesce(c.first_message_at, excluded.first_message_at),
                                     coalesce(excluded.first_message_at, c.first_message_at)),
            last_message_at  = greatest(coalesce(c.last_message_at, excluded.last_message_at),
                                        coalesce(excluded.last_message_at, c.last_message_at)),
            updated_at       = now()
    returning c.id into v_id;
    return query select v_id, 'upsert'::text;
end $$;

-- ─────────────────────────────── chain_get ───────────────────────────────────
create or replace function public.rpc_cap_chain_get(
    p_client_slug text, p_rpc_secret text, p_thread_id text
) returns setof public.cap_email_chains
language sql stable security definer
set search_path = public, extensions
as $$
    select c.* from public.cap_email_chains c
    where c.client_slug = public.cap_auth_client(p_client_slug, p_rpc_secret)
      and c.thread_id = btrim(p_thread_id)
    limit 1;
$$;

-- ─────────────────────────────── facture_find ────────────────────────────────
create or replace function public.rpc_cap_facture_find(
    p_client_slug text, p_rpc_secret text,
    p_numero text, p_fournisseur text default ''
) returns setof public.cap_factures
language sql stable security definer
set search_path = public, extensions
as $$
    select f.* from public.cap_factures f
    where f.client_slug = public.cap_auth_client(p_client_slug, p_rpc_secret)
      and upper(btrim(p_numero)) = upper(btrim(f.numero))
      and lower(btrim(p_fournisseur)) = lower(btrim(f.fournisseur))
    limit 1;
$$;

-- ─────────────────────────────── facture_upsert ──────────────────────────────
create or replace function public.rpc_cap_facture_upsert(
    p_client_slug text, p_rpc_secret text,
    p_numero text, p_fournisseur text, p_fournisseur_identifiant text default null,
    p_objet text default null, p_date_facture date default null,
    p_date_echeance date default null, p_montant_ht numeric default null,
    p_montant_tva numeric default null, p_montant_ttc numeric default null,
    p_devise text default 'EUR', p_confiance numeric default null,
    p_email_message_id text default null, p_document_id uuid default null,
    p_extraction jsonb default '{}'
) returns table (id uuid, action text)
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare v_slug text; v_id uuid; v_statut text;
begin
    v_slug := public.cap_auth_client(p_client_slug, p_rpc_secret);
    if p_numero is null or btrim(p_numero) = '' then
        raise exception 'numero de facture requis';
    end if;
    select f.id, f.statut into v_id, v_statut
    from public.cap_factures f
    where f.client_slug = v_slug
      and upper(btrim(p_numero)) = upper(btrim(f.numero))
      and lower(btrim(p_fournisseur)) = lower(btrim(f.fournisseur))
    limit 1;
    if v_id is not null then
        update public.cap_factures f set
            fournisseur_identifiant = coalesce(p_fournisseur_identifiant, f.fournisseur_identifiant),
            objet                   = coalesce(p_objet, f.objet),
            date_facture            = coalesce(p_date_facture, f.date_facture),
            date_echeance           = coalesce(p_date_echeance, f.date_echeance),
            montant_ht              = coalesce(p_montant_ht, f.montant_ht),
            montant_tva             = coalesce(p_montant_tva, f.montant_tva),
            montant_ttc             = coalesce(p_montant_ttc, f.montant_ttc),
            devise                  = p_devise,
            confiance               = coalesce(p_confiance, f.confiance),
            email_message_id        = coalesce(p_email_message_id, f.email_message_id),
            document_id             = coalesce(p_document_id, f.document_id),
            extraction              = p_extraction,
            statut                  = case when f.statut in ('extracted', 'rejete')
                                           then 'extracted' else f.statut end,
            updated_at              = now()
        where f.id = v_id
        returning f.id into v_id;
        return query select v_id, 'update'::text;
    else
        insert into public.cap_factures AS fx
            (client_slug, numero, fournisseur, fournisseur_identifiant, objet,
             date_facture, date_echeance, montant_ht, montant_tva, montant_ttc,
             devise, statut, confiance, email_message_id, document_id, extraction)
        values
            (v_slug, btrim(p_numero), btrim(p_fournisseur), p_fournisseur_identifiant,
             p_objet, p_date_facture, p_date_echeance, p_montant_ht, p_montant_tva,
             p_montant_ttc, p_devise, 'extracted', p_confiance, p_email_message_id,
             p_document_id, p_extraction)
        returning fx.id into v_id;
        return query select v_id, 'insert'::text;
    end if;
end $$;

-- ─────────────────────────────── pipeline_log ────────────────────────────────
create or replace function public.rpc_cap_pipeline_log(
    p_client_slug text, p_rpc_secret text,
    p_trigger text default 'cron', p_threads_seen int default 0,
    p_mails_new int default 0, p_mails_known int default 0,
    p_attachments_ocr int default 0, p_docs_indexed int default 0,
    p_factures_upserted int default 0, p_errors int default 0,
    p_last_error text default null, p_duration_ms int default null
) returns uuid
language sql volatile security definer
set search_path = public, extensions
as $$
    insert into public.cap_pipeline_runs
        (client_slug, run_trigger, threads_seen, mails_new, mails_known,
         attachments_ocr, docs_indexed, factures_upserted, errors,
         last_error, duration_ms)
    values
        (public.cap_auth_client(p_client_slug, p_rpc_secret), p_trigger,
         p_threads_seen, p_mails_new, p_mails_known, p_attachments_ocr,
         p_docs_indexed, p_factures_upserted, p_errors, p_last_error,
         p_duration_ms)
    returning id;
$$;

-- Grants (les RPC sont le SEUL accès agent — la garde cap_auth_client reste
-- interdite d'appel direct)
grant execute on function public.rpc_cap_doc_status(text, text, text[]) to anon, authenticated;
grant execute on function public.rpc_cap_doc_upsert(text, text, text, text, text, extensions.vector, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.rpc_cap_doc_search(text, text, extensions.vector, int, text) to anon, authenticated;
grant execute on function public.rpc_cap_email_upsert(text, text, text, text, text, text, text, timestamptz, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.rpc_cap_chain_upsert(text, text, text, text, jsonb, int, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.rpc_cap_chain_get(text, text, text) to anon, authenticated;
grant execute on function public.rpc_cap_facture_find(text, text, text, text) to anon, authenticated;
grant execute on function public.rpc_cap_facture_upsert(text, text, text, text, text, text, date, date, numeric, numeric, numeric, text, numeric, text, uuid, jsonb) to anon, authenticated;
grant execute on function public.rpc_cap_pipeline_log(text, text, text, int, int, int, int, int, int, int, text, int) to anon, authenticated;
