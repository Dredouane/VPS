-- HermesCapabilities — SQL GÉNÉRIQUE — 007_app_users.sql
-- Utilisateurs de la webapp HermesWeb (volet webapp CRUD, D6/D7/D8) :
-- mapping auth Supabase ↔ client_slug + rôle applicatif.
--   admin     : Redouane (gestion clients + users)
--   backoffice: référent PME (validation factures, consultation)
--   terrain   : accès terrain mobile (lecture + remontées)
-- Écriture : webapp uniquement (service key serveur). RLS deny-all.
-- ⚠️ PAS ENCORE APPLIQUÉ — à appliquer via scripts/supabase-sql.sh (D9).

create table if not exists public.app_users (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null unique references auth.users(id),
    client_slug text not null,
    role        text not null default 'backoffice'
                    check (role in ('admin', 'backoffice', 'terrain')),
    actif       boolean not null default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists app_users_slug_idx
    on public.app_users (client_slug);

-- FK registry : un user webapp ne peut référencer qu'un client déclaré (D7-ter)
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'app_users_slug_fk') then
    alter table public.app_users add constraint app_users_slug_fk
        foreign key (client_slug) references public.cap_clients(slug);
  end if;
end $$;

alter table public.app_users enable row level security;
revoke all on public.app_users from anon, authenticated;
