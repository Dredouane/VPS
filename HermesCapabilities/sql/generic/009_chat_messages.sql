-- HermesCapabilities — SQL GÉNÉRIQUE — 009_chat_messages.sql
-- Historique persistant du chat webapp Alinea (décision architecte D-A) :
-- 1 thread = une conversation email ; le chat répond à partir des documents
-- du thread et laisse une trace auditable (sources citées).
-- Écriture : webapp uniquement (service key serveur). RLS deny-all.
-- ⚠️ Appliquer via scripts/supabase-sql.sh --file (décision ciblée).

create table if not exists public.app_chat_messages (
    id          uuid primary key default gen_random_uuid(),
    client_slug text not null,
    thread_id   text not null,
    role        text not null check (role in ('user', 'assistant')),
    content     text not null,
    sources     jsonb not null default '[]',
    created_at  timestamptz not null default now()
);

create index if not exists app_chat_messages_thread_idx
    on public.app_chat_messages (client_slug, thread_id, created_at);

-- FK registry : aucun message sans client déclaré (D7-ter)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'app_chat_messages_slug_fk') then
    alter table public.app_chat_messages add constraint app_chat_messages_slug_fk
        foreign key (client_slug) references public.cap_clients(slug);
  end if;
end $$;

alter table public.app_chat_messages enable row level security;
revoke all on public.app_chat_messages from anon, authenticated;
