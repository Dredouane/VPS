-- HermesCapabilities — SQL GÉNÉRIQUE — 004_rls_migrations.sql
-- Defense in depth : le tracker du runner passe aussi en RLS deny-all
-- (le runner utilise l'accès admin qui bypass RLS — les agents n'y touchent
-- jamais).

alter table public.cap_migrations enable row level security;
revoke all on public.cap_migrations from anon, authenticated;
