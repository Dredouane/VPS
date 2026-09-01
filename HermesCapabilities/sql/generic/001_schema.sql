-- HermesCapabilities — SQL GÉNÉRIQUE — 001_schema.sql
-- Structure commune à TOUS les clients : tables public.cap_*, discriminées
-- par client_slug (un slug = un client — DECISIONS D7-v2/D9-v2).
-- RLS deny-all : les agents n'accèdent JAMAIS aux tables directement,
-- uniquement via les RPC dédiées par slug.

create extension if not exists vector with schema extensions;

create table if not exists public.cap_documents (
    id                 uuid primary key default gen_random_uuid(),
    client_slug        text not null,
    kind               text not null check (kind in ('email', 'attachment')),
    message_id         text not null,
    thread_id          text,
    thread_role        text check (thread_role is null or thread_role in ('nouveau','reponse','transfert')),
    parent_message_id  text,
    source             text not null default 'gmail',
    title              text,
    content            text not null,
    content_md5        text not null default md5(''),
    embedding          extensions.vector(768),
    metadata           jsonb not null default '{}',
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create unique index if not exists cap_documents_slug_kind_md5_idx
    on public.cap_documents (client_slug, kind, content_md5);
create index if not exists cap_documents_slug_message_idx
    on public.cap_documents (client_slug, message_id);
create index if not exists cap_documents_slug_thread_idx
    on public.cap_documents (client_slug, thread_id);
create index if not exists cap_documents_embedding_idx
    on public.cap_documents using hnsw (embedding extensions.vector_cosine_ops);

create table if not exists public.cap_emails (
    id             uuid primary key default gen_random_uuid(),
    client_slug    text not null,
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
    unique (client_slug, message_id)
);
create index if not exists cap_emails_slug_status_idx
    on public.cap_emails (client_slug, status);

create table if not exists public.cap_factures (
    id                       uuid primary key default gen_random_uuid(),
    client_slug              text not null,
    numero                   text not null,
    fournisseur              text not null default '',
    fournisseur_identifiant  text,
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
    email_message_id         text,
    document_id              uuid references public.cap_documents(id),
    extraction               jsonb not null default '{}',
    created_at               timestamptz not null default now(),
    updated_at               timestamptz not null default now(),
    unique (client_slug, numero, fournisseur)
);
create index if not exists cap_factures_slug_statut_idx
    on public.cap_factures (client_slug, statut);
create index if not exists cap_factures_slug_echeance_idx
    on public.cap_factures (client_slug, date_echeance);

create table if not exists public.cap_pipeline_runs (
    id                 uuid primary key default gen_random_uuid(),
    client_slug        text not null,
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
create index if not exists cap_pipeline_runs_slug_run_idx
    on public.cap_pipeline_runs (client_slug, run_at desc);

-- RLS deny-all (l'agent = clé publishable + RPC only ; webapp = service key)
alter table public.cap_documents     enable row level security;
alter table public.cap_emails        enable row level security;
alter table public.cap_factures      enable row level security;
alter table public.cap_pipeline_runs enable row level security;
revoke all on public.cap_documents     from anon, authenticated;
revoke all on public.cap_emails        from anon, authenticated;
revoke all on public.cap_factures      from anon, authenticated;
revoke all on public.cap_pipeline_runs from anon, authenticated;
