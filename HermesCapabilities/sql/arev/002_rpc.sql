-- HermesCapabilities — client arev — 002_rpc.sql
-- RPC d'accès de l'agent : public, security definer, search_path figé
-- (anti hijack), client_id HARDCODÉ 'arev' (D8 — impossible d'agir sur un
-- autre client même avec la clé). Clé utilisée = publishable (anon).
-- Les tables ne sont JAMAIS exposées (voir 003_rls.sql).

-- ------------------------------------------------------------- doc_status
-- Quels messages du thread sont déjà indexés ? (idempotence D3/D11)
create or replace function public.rpc_cap_arev_doc_status(p_message_ids text[])
returns table (message_id text, known boolean)
language sql stable security definer
set search_path = public, extensions, cap_arev
as $$
    select m.message_id,
           exists (select 1
                   from cap_arev.documents d
                   where d.client_id = 'arev'
                     and d.message_id = m.message_id) as known
    from unnest(p_message_ids) as m(message_id);
$$;

-- ------------------------------------------------------------- doc_upsert
-- Indexe (ou met à jour) un document dans le RAG. Dedup par contenu.
create or replace function public.rpc_cap_arev_doc_upsert(
    p_kind             text,               -- 'email' | 'attachment'
    p_message_id       text,
    p_thread_id        text default null,
    p_thread_role      text default null,
    p_parent_message_id text default null,  -- pour kind=attachment
    p_title            text default null,
    p_content          text not null,
    p_embedding        extensions.vector,   -- 768d (D5)
    p_metadata         jsonb default '{}'
) returns uuid
language plpgsql volatile security definer
set search_path = public, extensions, cap_arev
as $$
declare
    v_id uuid;
begin
    if p_kind not in ('email', 'attachment') then
        raise exception 'kind invalide: %', p_kind;
    end if;
    if p_embedding is null or vector_dims(p_embedding) <> 768 then
        raise exception 'embedding requis (768d, text-embedding-004)';
    end if;

    insert into cap_arev.documents
        (client_id, kind, message_id, thread_id, thread_role,
         parent_message_id, title, content, content_md5, embedding, metadata)
    values
        ('arev', p_kind, p_message_id, p_thread_id, p_thread_role,
         p_parent_message_id, p_title, p_content, md5(p_content),
         p_embedding, p_metadata)
    on conflict (client_id, kind, content_md5) do update
        set embedding  = excluded.embedding,
            metadata   = excluded.metadata,
            updated_at = now()
    returning id into v_id;

    return v_id;
end $$;

-- ------------------------------------------------------------- doc_search
-- Recherche par similarité (skill rag-search). Limite bornée 1..20.
create or replace function public.rpc_cap_arev_doc_search(
    p_query_embedding extensions.vector,
    p_match_count     int default 5,
    p_kind            text default null
) returns table (id uuid, kind text, title text, content text,
                 metadata jsonb, similarity float)
language sql stable security definer
set search_path = public, extensions, cap_arev
as $$
    select d.id, d.kind, d.title, d.content, d.metadata,
           1 - (d.embedding <=> p_query_embedding) as similarity
    from cap_arev.documents d
    where d.client_id = 'arev'
      and (p_kind is null or d.kind = p_kind)
      and d.embedding is not null
    order by d.embedding <=> p_query_embedding
    limit greatest(1, least(coalesce(p_match_count, 5), 20));
$$;

-- ------------------------------------------------------------- email_upsert
-- État de traitement d'un message (idempotent, compteur d'erreurs).
create or replace function public.rpc_cap_arev_email_upsert(
    p_message_id    text,
    p_thread_id     text default null,
    p_thread_role   text default null,
    p_from_addr     text default null,
    p_subject       text default null,
    p_mail_date     timestamptz default null,
    p_classification text default null,
    p_resume        text default null,
    p_status        text default 'received',
    p_error         text default null,
    p_raw_metadata  jsonb default '{}'
) returns uuid
language plpgsql volatile security definer
set search_path = public, extensions, cap_arev
as $$
declare
    v_id uuid;
begin
    if p_status not in ('received', 'processed', 'error') then
        raise exception 'status invalide: %', p_status;
    end if;

    insert into cap_arev.emails
        (client_id, message_id, thread_id, thread_role, from_addr, subject,
         mail_date, classification, resume, status, error, raw_metadata)
    values
        ('arev', p_message_id, p_thread_id, p_thread_role, p_from_addr,
         p_subject, p_mail_date, p_classification, p_resume, p_status,
         p_error, p_raw_metadata)
    on conflict (client_id, message_id) do update
        set classification = coalesce(excluded.classification, cap_arev.emails.classification),
            resume         = coalesce(excluded.resume, cap_arev.emails.resume),
            status         = excluded.status,
            error          = excluded.error,
            raw_metadata   = excluded.raw_metadata,
            attempts       = cap_arev.emails.attempts
                             + (case when excluded.status = 'error' then 1 else 0 end),
            updated_at     = now()
    returning id into v_id;

    return v_id;
end $$;

-- ------------------------------------------------------------- facture_find
-- Matching d'une facture existante (numero + fournisseur, insensible casse).
create or replace function public.rpc_cap_arev_facture_find(
    p_numero      text,
    p_fournisseur text default ''
) returns setof cap_arev.factures
language sql stable security definer
set search_path = public, extensions, cap_arev
as $$
    select f.*
    from cap_arev.factures f
    where f.client_id = 'arev'
      and upper(btrim(p_numero)) = upper(btrim(f.numero))
      and lower(btrim(p_fournisseur)) = lower(btrim(f.fournisseur))
    limit 1;
$$;

-- ------------------------------------------------------------- facture_upsert
-- Extraction expert facturation (D6) : insert si nouvelle, update si
-- connue. Règle métier : si la facture existante est déjà 'valide' ou
-- 'paye' (validée par un humain), le statut N'EST PAS rétrogradé.
create or replace function public.rpc_cap_arev_facture_upsert(
    p_numero                  text,
    p_fournisseur             text,
    p_fournisseur_identifiant text default null,
    p_objet                   text default null,
    p_date_facture            date default null,
    p_date_echeance           date default null,
    p_montant_ht              numeric default null,
    p_montant_tva             numeric default null,
    p_montant_ttc             numeric default null,
    p_devise                  text default 'EUR',
    p_confiance               numeric default null,
    p_email_message_id        text default null,
    p_document_id             uuid default null,
    p_extraction              jsonb default '{}'
) returns table (id uuid, action text)
language plpgsql volatile security definer
set search_path = public, extensions, cap_arev
as $$
declare
    v_id      uuid;
    v_action  text;
    v_statut  text;
begin
    if p_numero is null or btrim(p_numero) = '' then
        raise exception 'numero de facture requis';
    end if;

    select f.id, f.statut into v_id, v_statut
    from cap_arev.factures f
    where f.client_id = 'arev'
      and upper(btrim(p_numero)) = upper(btrim(f.numero))
      and lower(btrim(p_fournisseur)) = lower(btrim(f.fournisseur))
    limit 1;

    if v_id is not null then
        update cap_arev.factures f set
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
                                           then 'extracted'        -- ré-extraction
                                           else f.statut end,      -- valide/paye : préservé
            updated_at              = now()
        where f.id = v_id
        returning f.id into v_id;
        v_action := 'update';
    else
        insert into cap_arev.factures
            (client_id, numero, fournisseur, fournisseur_identifiant, objet,
             date_facture, date_echeance, montant_ht, montant_tva, montant_ttc,
             devise, statut, confiance, email_message_id, document_id, extraction)
        values
            ('arev', btrim(p_numero), btrim(p_fournisseur), p_fournisseur_identifiant,
             p_objet, p_date_facture, p_date_echeance, p_montant_ht, p_montant_tva,
             p_montant_ttc, p_devise, 'extracted', p_confiance, p_email_message_id,
             p_document_id, p_extraction)
        returning id into v_id;
        v_action := 'insert';
    end if;

    return query select v_id, v_action;
end $$;

-- ------------------------------------------------------------- pipeline_log
-- Observabilité silencieuse (D11) : 1 ligne par run.
create or replace function public.rpc_cap_arev_pipeline_log(
    p_trigger           text default 'cron',
    p_threads_seen      int default 0,
    p_mails_new         int default 0,
    p_mails_known       int default 0,
    p_attachments_ocr   int default 0,
    p_docs_indexed      int default 0,
    p_factures_upserted int default 0,
    p_errors            int default 0,
    p_last_error        text default null,
    p_duration_ms       int default null
) returns uuid
language sql volatile security definer
set search_path = public, extensions, cap_arev
as $$
    insert into cap_arev.pipeline_runs
        (client_id, run_trigger, threads_seen, mails_new, mails_known,
         attachments_ocr, docs_indexed, factures_upserted, errors,
         last_error, duration_ms)
    values
        ('arev', p_trigger, p_threads_seen, p_mails_new, p_mails_known,
         p_attachments_ocr, p_docs_indexed, p_factures_upserted, p_errors,
         p_last_error, p_duration_ms)
    returning id;
$$;
