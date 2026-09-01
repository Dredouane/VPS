-- HermesCapabilities — SQL GÉNÉRIQUE — 002_clients.sql
-- Registry clients (D7-ter) : source de vérité déclarative, gérée par le
-- RUNNER uniquement (aucune RPC pour l'agent — le slug est hardcodé).
-- FK : aucune ligne de données sans client déclaré (fantômes impossibles).

create table if not exists public.cap_clients (
    slug       text primary key,
    nom        text not null,
    statut     text not null default 'active'
                   check (statut in ('active', 'suspended', 'archived')),
    referent   text,                -- référent (email / nom), optionnel
    rpc_prefix text not null,       -- ex: rpc_cap_arev_
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.cap_clients enable row level security;
revoke all on public.cap_clients from anon, authenticated;

-- Intégrité : les tables de données ne peuvent référencer qu'un client
-- déclaré. Idempotent (safe --force) : chaque FK n'est ajoutée que si absente.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cap_documents_slug_fk') then
    alter table public.cap_documents add constraint cap_documents_slug_fk
        foreign key (client_slug) references public.cap_clients(slug);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cap_emails_slug_fk') then
    alter table public.cap_emails add constraint cap_emails_slug_fk
        foreign key (client_slug) references public.cap_clients(slug);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cap_factures_slug_fk') then
    alter table public.cap_factures add constraint cap_factures_slug_fk
        foreign key (client_slug) references public.cap_clients(slug);
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cap_pipeline_runs_slug_fk') then
    alter table public.cap_pipeline_runs add constraint cap_pipeline_runs_slug_fk
        foreign key (client_slug) references public.cap_clients(slug);
  end if;
end $$;
