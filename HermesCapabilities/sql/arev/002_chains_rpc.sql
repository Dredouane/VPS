-- HermesCapabilities — SQL DÉDIÉ slug arev — 002_chains_rpc.sql
-- RPC chaînes d'emails (C2) — slug hardcodé 'arev', tables génériques.

create or replace function public.rpc_cap_arev_chain_upsert(
    p_thread_id       text,
    p_subject         text default null,
    p_participants    jsonb default '[]',
    p_messages_count  int default 0,
    p_first_message_at timestamptz default null,
    p_last_message_at  timestamptz default null
) returns table (id uuid, action text)
language plpgsql volatile security definer
set search_path = public, extensions
as $$
declare v_id uuid; v_action text;
begin
    if p_thread_id is null or btrim(p_thread_id) = '' then
        raise exception 'thread_id requis';
    end if;

    insert into public.cap_email_chains AS c
        (client_slug, thread_id, subject, participants,
         messages_count, first_message_at, last_message_at)
    values
        ('arev', btrim(p_thread_id), p_subject, p_participants,
         greatest(coalesce(p_messages_count, 0), 0),
         p_first_message_at, p_last_message_at)
    on conflict (client_slug, thread_id) do update
        set subject          = coalesce(excluded.subject, c.subject),
            participants     = case
                                 when excluded.participants <> '[]'::jsonb
                                 then excluded.participants else c.participants end,
            messages_count   = greatest(c.messages_count, excluded.messages_count),
            first_message_at = least(coalesce(c.first_message_at, excluded.first_message_at),
                                     coalesce(excluded.first_message_at, c.first_message_at)),
            last_message_at  = greatest(coalesce(c.last_message_at, excluded.last_message_at),
                                        coalesce(excluded.last_message_at, c.last_message_at)),
            updated_at       = now()
    returning c.id into v_id;

    v_action := 'upsert';
    return query select v_id, v_action;
end $$;

create or replace function public.rpc_cap_arev_chain_get(p_thread_id text)
returns setof public.cap_email_chains
language sql stable security definer
set search_path = public, extensions
as $$
    select c.* from public.cap_email_chains c
    where c.client_slug = 'arev' and c.thread_id = btrim(p_thread_id)
    limit 1;
$$;

grant execute on function public.rpc_cap_arev_chain_upsert(text, text, jsonb, int, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.rpc_cap_arev_chain_get(text) to anon, authenticated;
