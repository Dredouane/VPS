# TKT-109 — Pipeline: R2 keys in the metadata (handover to the pipeline session)

> Ticket to be executed by the **pipeline session** (HermesCapabilities), not by
> the webapp. Handed over as a mini-prompt on 2026-09-08.

- **Date**: 2026-09-08
- **Persona**: Salarie_Backoffice (beneficiary — via Alinea)
- **Priority**: Medium
- **Type**: Pipeline ⇄ webapp integration

## Description (the contract)
The webapp offers "Ouvrir" [Open] on attachments (signed R2 URL) as soon as
`cap_documents.metadata.r2_key` exists. **M2.8 delivered the r2_key for the
attachments (kind=attachment)** — to be verified in prod and completed for the mails.

## Current state (M2.8 — verified in prod 2026-09-08)
- ⚠️ Attachments: docs indexed **BEFORE M2.8** have no r2_key (verified:
  presign → `r2_key_unavailable` on invoice 2026-163). Upcoming
  attachments processed by M2.8 should have it — to be confirmed on the next real run.
- ❓ Mails (kind=email): key of the raw `thread.json` not traced
- ❓ Backfill of the historical rows (or re-run `force-attachments`) if we
  want the raw of existing attachments

## Expected state
1. Prod verification: presign OK on a real attachment (invoice 2026-163).
2. (Optional) `metadata.r2_key` on the kind=email docs (thread.json of the
   mail) for a complete "Voir l'email brut" [See the raw email].
3. (Optional) Backfill of the historical rows if necessary.

## Acceptance criteria
- [ ] Webapp presign OK on a real attachment (verified by the webapp session — V0)
- [ ] (Option) r2_key on the email docs
- [ ] Key convention unchanged: `<GED_EMAIL_PREFIX>/<slug>/emails/<thread_id>/<file>`

## Notes
Convention: WEBAPP_DATA_MAPPING.md §2.5. Non-blocking for the webapp
(disabled button + "raw unavailable" mention if the key is missing).
