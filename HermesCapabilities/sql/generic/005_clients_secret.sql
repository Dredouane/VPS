-- HermesCapabilities — SQL GÉNÉRIQUE — 005_clients_secret.sql
-- Secret RPC par client (D8-v3, option B) : les RPC génériques exigent le
-- couple (slug, rpc_secret). Le runner génère le secret à la déclaration et
-- l'écrit dans clients/<slug>/client.env (CLIENT_RPC_SECRET, 600).

alter table public.cap_clients add column if not exists rpc_secret text;

create unique index if not exists cap_clients_rpc_secret_idx
    on public.cap_clients (rpc_secret);
