-- HermesCapabilities — SQL GÉNÉRIQUE — 003_chains.sql
-- Chaînes d'emails (emailChains) : 1 ligne par thread Gmail traité.
-- Alimentées par la capability email-processing (C2) après thread_parser.

create table if not exists public.cap_email_chains (
    id                uuid primary key default gen_random_uuid(),
    client_slug       text not null,
    thread_id         text not null,           -- X-GM-THRID (gmail)
    subject           text,                    -- sujet normalisé (sans Re:/Tr:)
    participants      jsonb not null default '[]',  -- adresses dédupliquées
    messages_count    int not null default 0,
    first_message_at  timestamptz,
    last_message_at   timestamptz,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    unique (client_slug, thread_id)
);

create index if not exists cap_email_chains_slug_last_idx
    on public.cap_email_chains (client_slug, last_message_at desc);

alter table public.cap_email_chains enable row level security;
revoke all on public.cap_email_chains from anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cap_email_chains_slug_fk') then
    alter table public.cap_email_chains add constraint cap_email_chains_slug_fk
        foreign key (client_slug) references public.cap_clients(slug);
  end if;
end $$;
