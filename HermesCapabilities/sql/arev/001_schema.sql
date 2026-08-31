-- HermesCapabilities — client arev — 001_schema.sql
-- Schéma cap_arev : données agent (RAG pgvector, emails, factures, runs).
-- Ordre d'application : 001 → 002 → 003. Projet TEST d'abord, puis prod.
-- Contexte : DECISIONS.md D5-D9 · PIPELINE_EMAIL_AREV.md §5 · sql/README.md

-- pgvector (Supabase : type dans le schéma extensions)
create extension if not exists vector with schema extensions;

create schema if not exists cap_arev;

-- ---------------------------------------------------------------- documents
-- RAG : emails (contenu nouveau) + pièces jointes (texte OCR).
-- Dedup par contenu : unique (client_id, kind, content_md5) — un email cité
-- à nouveau ou une PJ déjà indexée ne crée pas de doublon (D3/D11).
create table if not exists cap_arev.documents (
    id                 uuid primary key default gen_random_uuid(),
    client_id          text not null default 'arev',
    kind               text not null check (kind in ('email', 'attachment')),
    message_id         text not null,            -- gmail message id (parent si PJ)
    thread_id          text,
    thread_role        text check (thread_role is null or thread_role in ('nouveau','reponse','transfert')),
    parent_message_id  text,                     -- attachment → email source
    source             text not null default 'gmail',
    title              text,
    content            text not null,
    content_md5        text not null default md5(''),
    embedding          extensions.vector(768),  -- D5 : dimension figée
    metadata           jsonb not null default '{}',
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create unique index if not exists documents_client_kind_md5_idx
    on cap_arev.documents (client_id, kind, content_md5);
create index if not exists documents_client_message_idx
    on cap_arev.documents (client_id, message_id);
create index if not exists documents_client_thread_idx
    on cap_arev.documents (client_id, thread_id);
create index if not exists documents_embedding_idx
    on cap_arev.documents using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------- emails
-- État de traitement par message gmail (pipeline, retries, erreurs).
create table if not exists cap_arev.emails (
    id             uuid primary key default gen_random_uuid(),
    client_id      text not null default 'arev',
    message_id     text not null,
    thread_id      text,
    thread_role    text,
    from_addr      text,
    subject        text,
    mail_date      timestamptz,
    classification text,
    resume         text,
    status         text not null default 'received'
                       check (status in ('received', 'processed', 'error')),
    error          text,
    attempts       int not null default 0,
    raw_metadata   jsonb not null default '{}',
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    unique (client_id, message_id)
);

-- ---------------------------------------------------------------- factures
-- Extraction de l'expert facturation (C6). Clé de matching :
-- (client_id, numero, fournisseur). Validation humaine = transition de
-- statut dans la webapp (D6) : extracted → valide | rejete → paye | archive.
create table if not exists cap_arev.factures (
    id                       uuid primary key default gen_random_uuid(),
    client_id                text not null default 'arev',
    numero                   text not null,
    fournisseur              text not null default '',
    fournisseur_identifiant  text,          -- siret / tva si présent
    objet                    text,
    date_facture             date,
    date_echeance            date,
    montant_ht               numeric(12,2),
    montant_tva              numeric(12,2),
    montant_ttc              numeric(12,2),
    devise                   text not null default 'EUR',
    statut                   text not null default 'extracted'
                                 check (statut in ('extracted','valide','rejete','paye','archive')),
    confiance                numeric(4,3) check (confiance is null or (confiance >= 0 and confiance <= 1)),
    email_message_id         text,          -- email source
    document_id              uuid references cap_arev.documents(id),
    extraction               jsonb not null default '{}',  -- payload brut (audit)
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    unique (client_id, numero, fournisseur)
);

create index if not exists factures_client_statut_idx
    on cap_arev.factures (client_id, statut);
create index if not exists factures_client_echeance_idx
    on cap_arev.factures (client_id, date_echeance);

-- ---------------------------------------------------------------- pipeline_runs
-- Observabilité silencieuse (D11) : 1 ligne par run du pipeline.
create table if not exists cap_arev.pipeline_runs (
    id                 uuid primary key default gen_random_uuid(),
    client_id          text not null default 'arev',
    run_at             timestamptz not null default now(),
    run_trigger        text not null default 'cron',
    threads_seen       int not null default 0,
    mails_new          int not null default 0,
    mails_known        int not null default 0,
    attachments_ocr    int not null default 0,
    docs_indexed       int not null default 0,
    factures_upserted  int not null default 0,
    errors             int not null default 0,
    last_error         text,
    duration_ms        int
);

create index if not exists pipeline_runs_client_run_idx
    on cap_arev.pipeline_runs (client_id, run_at desc);
