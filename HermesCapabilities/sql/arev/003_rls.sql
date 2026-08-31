-- HermesCapabilities — client arev — 003_rls.sql
-- Cloisonnement de l'accès (D7/D8) :
--   - Tables : RLS activé, AUCUNE policy → aucun accès direct via l'API
--     (PostgREST n'expose pas le schéma cap_arev ; on révoque en plus les
--     grants, ceinture + bretelles).
--   - RPC : seules fonctions exécutables, en security definer avec client
--     hardcodé — la clé publishable (anon) ne peut RIEN faire d'autre.
--   - La service key (service_role, BYPASSRLS) reste réservée à la webapp /
--     l'administration — JAMAIS distribuée à un agent.

alter table cap_arev.documents     enable row level security;
alter table cap_arev.emails        enable row level security;
alter table cap_arev.factures      enable row level security;
alter table cap_arev.pipeline_runs enable row level security;

-- Aucune policy créée volontairement : deny-all par défaut.
-- (Les RPC security definer contournent RLS par design — owner = postgres.)

revoke all on schema cap_arev from anon, authenticated;
revoke all on all tables    in schema cap_arev from anon, authenticated;
revoke all on all sequences in schema cap_arev from anon, authenticated;
revoke all on all functions in schema cap_arev from anon, authenticated;

-- Grants explicites sur les RPC (public → EXECUTE existe par défaut ;
-- on l'écrit pour la clarté et pour survivre à un changement de défaut).
grant execute on function public.rpc_cap_arev_doc_status(text[]) to anon, authenticated;
grant execute on function public.rpc_cap_arev_doc_upsert(text, text, text, text, text, text, text, extensions.vector, jsonb) to anon, authenticated;
grant execute on function public.rpc_cap_arev_doc_search(extensions.vector, int, text) to anon, authenticated;
grant execute on function public.rpc_cap_arev_email_upsert(text, text, text, text, text, timestamptz, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.rpc_cap_arev_facture_find(text, text) to anon, authenticated;
grant execute on function public.rpc_cap_arev_facture_upsert(text, text, text, text, date, date, numeric, numeric, numeric, text, numeric, text, uuid, jsonb) to anon, authenticated;
grant execute on function public.rpc_cap_arev_pipeline_log(text, int, int, int, int, int, int, int, text, int) to anon, authenticated;

-- Vérification post-application (à exécuter manuellement après 003) :
--   select proname from pg_proc where proname like 'rpc_cap_arev_%';
--   → 7 fonctions attendues.
--   select schemaname, tablename, rowsecurity from pg_tables where schemaname = 'cap_arev';
--   → 4 tables, rowsecurity = true.
