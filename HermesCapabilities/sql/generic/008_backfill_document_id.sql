-- 008_backfill_document_id.sql — D21: rattache factures existantes à leurs documents
-- et corrige r2_key sur les attachments qui pointaient vers thread.json.
-- Append-only (ne modifie pas les migrations précédentes).

-- ── 1. Backfill document_id sur les factures ──────────────────────────────────
-- Lie chaque facture (email_message_id) à l'attachment OCR qui l'a extraite.
update public.cap_factures f
set document_id = d.id
from public.cap_documents d
where f.document_id is null
  and f.email_message_id is not null
  and d.client_slug = f.client_slug
  and d.kind = 'attachment'
  and d.parent_message_id = f.email_message_id;

-- ── 2. Fix r2_key sur les attachments qui pointent vers thread.json ───────────
-- Reconstruit la clé correcte : emails/{slug}/emails/{thread_id}/{filename}
update public.cap_documents
set metadata = jsonb_set(
    metadata,
    '{r2_key}',
    to_jsonb(
        coalesce((metadata->>'thread_id'), '') || '/' ||
        coalesce((metadata->>'filename'), 'thread.json')
    )
)
where kind = 'attachment'
  and metadata->>'r2_key' = 'thread.json'
  and metadata->>'filename' is not null;

-- ── 3. Vérification (smoke) ──────────────────────────────────────────────────
-- Cette requête doit retourner 0 lignes après exécution :
-- SELECT f.id, f.numero, f.document_id, d.title
-- FROM cap_factures f
-- LEFT JOIN cap_documents d ON d.id = f.document_id
-- WHERE f.document_id IS NULL AND f.email_message_id IS NOT NULL;
