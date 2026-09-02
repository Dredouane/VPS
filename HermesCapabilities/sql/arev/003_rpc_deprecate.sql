-- HermesCapabilities — SQL DÉDIÉ slug arev — 003_rpc_deprecate.sql
-- Clean swap (D8-v3, 01/09) : les RPC per-slug sont remplacées par les
-- génériques (sql/generic/006_rpc_generic.sql — slug + rpc_secret).
-- Idempotent (IF EXISTS) : sans effet sur une installation neuve.

drop function if exists public.rpc_cap_arev_doc_status(text[]);
drop function if exists public.rpc_cap_arev_doc_upsert(text, text, text, extensions.vector, text, text, text, text, jsonb);
drop function if exists public.rpc_cap_arev_doc_search(extensions.vector, int, text);
drop function if exists public.rpc_cap_arev_email_upsert(text, text, text, text, text, timestamptz, text, text, text, text, jsonb);
drop function if exists public.rpc_cap_arev_facture_find(text, text);
drop function if exists public.rpc_cap_arev_facture_upsert(text, text, text, text, date, date, numeric, numeric, numeric, text, numeric, text, uuid, jsonb);
drop function if exists public.rpc_cap_arev_pipeline_log(text, int, int, int, int, int, int, int, text, int);
drop function if exists public.rpc_cap_arev_chain_upsert(text, text, jsonb, int, timestamptz, timestamptz);
drop function if exists public.rpc_cap_arev_chain_get(text);
