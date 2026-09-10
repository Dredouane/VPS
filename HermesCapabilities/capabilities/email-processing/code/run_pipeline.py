#!/usr/bin/env python3
"""HermesCapabilities — email-processing — ORCHESTRATEUR du pipeline email.

Enchaîne les modules déterministes sur <= N threads non traités (D12) :
poll -> parse (+SAVE chains/emails) -> GED R2 -> OCR x2 -> juge -> [bifurcation
facture: adaptateur + check -> facture_upsert] -> embed -> doc_upsert ->
mark_done (UIDs des mails NOUVEAUX uniquement — D15) -> pipeline_log.
Idempotent à chaque niveau. Usage : run_pipeline.py [--max-threads 5] [--dry-run]
"""
import json
import os
import sys

CODE = os.path.dirname(os.path.abspath(__file__))
for _p in (CODE, os.path.join(CODE, "..", "email-gmail"),
           os.path.join(CODE, "..", "rag-embeddings"),
           os.path.join(CODE, "..", "rag-supabase"),
           os.path.join(CODE, "..", "doc-ocr"),
           os.path.join(CODE, "..", "ged-r2")):
    sys.path.insert(0, os.path.abspath(_p))

import imap_poll  # noqa: E402
import thread_parser  # noqa: E402
import ged_save  # noqa: E402
import ocr_gemini  # noqa: E402
import ocr_openrouter  # noqa: E402
import ocr_judge  # noqa: E402
import invoice_adapter  # noqa: E402
import invoice_check  # noqa: E402
import embed_gemini  # noqa: E402
import rpc_call  # noqa: E402
import imap_mark_done  # noqa: E402
import clean_body  # noqa: E402


def rpc(fn, payload):
    return rpc_call.call(fn, rpc_call.client_payload(payload))


def run(max_threads, dry, force_attachments=False):
    env = os.environ
    slug = env.get("CLIENT_SLUG", "")
    if not slug:
        raise RuntimeError("CLIENT_SLUG absente")
    tol = float(env.get("OCR_INVOICE_TOLERANCE") or 0.02)
    result = {"threads": [], "processed": 0, "errors": []}
    poll = imap_poll.run({
        "VPS_GMAIL_RECEPTION_IMAP_ADRESS": env.get("VPS_GMAIL_RECEPTION_IMAP_ADRESS"),
        "VPS_GMAIL_RECEPTION_IMAP_MDP": env.get("VPS_GMAIL_RECEPTION_IMAP_MDP"),
        "GMAIL_ALIAS_TAG": env.get("GMAIL_ALIAS_TAG") or "+AREV",
        "GMAIL_LABEL_DONE": env.get("GMAIL_LABEL_DONE") or "ia-traite",
        "GMAIL_MAX_THREADS": str(max_threads),
        "GMAIL_SPOOL_DIR": env.get("GMAIL_SPOOL_DIR") or "/opt/data/spool/gmail",
        "GMAIL_NEWER_THAN_DAYS": env.get("GMAIL_NEWER_THAN_DAYS") or "90"})
    result["polled"] = poll["count"]
    if poll["count"] == 0:
        return result
    key_gemini = env.get("VPS_GEMINI_API_KEY", "")
    key_or = env.get("VPS_OPEN_ROUTER_API_KEY", "")
    or_model = env.get("OCR_OPENROUTER_MODEL") or "openai/gpt-4o-mini"

    for t in poll["threads"]:
        tid = t["thread_id"]
        entry = {"thread_id": tid, "mails_new": 0, "docs_indexed": 0,
                 "attachments_ocr": 0, "factures": 0, "errors": 0}
        try:
            spool_path = t["spool_path"]
            thread = json.load(open(spool_path, encoding="utf-8"))
            all_ids = [m["message_id"] for m in thread["messages"]]
            status_raw = rpc("rpc_cap_doc_status", {"p_message_ids": all_ids})
            if isinstance(status_raw, list):
                status = [r for r in status_raw if isinstance(r, dict)]
            elif isinstance(status_raw, tuple):
                status = [r for r in status_raw if isinstance(r, dict)]
            else:
                status = [status_raw] if isinstance(status_raw, dict) else []
            known = {s["message_id"] for s in (status if isinstance(status, list) else [status])
                     if isinstance(s, dict) and s.get("known")}
            parsed = thread_parser.parse_thread(thread, known)
            mails_new = [m for m in parsed["mails"] if m["rag_status"] == "new"]
            # --force-attachments: récupération (mail known mais PJ jamais traitée)
            mails = mails_new + ([m for m in parsed["mails"]
                                  if m["rag_status"] == "known"] if force_attachments else [])
            entry["debug_mails_force"] = {"force": force_attachments,
                                          "total_mails": len(mails),
                                          "atts": sum(len(m["attachments"]) for m in mails)}
            entry["mails_new"] = len(mails_new)
            entry["mails_known"] = parsed["stats"]["known"]
            c = parsed["chain"]
            from datetime import datetime

            def iso(s):
                try:
                    return datetime.fromisoformat(s).isoformat()
                except Exception:
                    return None
            rpc("rpc_cap_chain_upsert", {
                "p_thread_id": tid, "p_subject": c["subject"],
                "p_participants": c["participants"],
                "p_messages_count": c["messages_count"],
                "p_first_message_at": iso(c["first_message_at"]),
                "p_last_message_at": iso(c["last_message_at"])})
            if dry:
                result["threads"].append(dict(entry, dry=True))
                continue
            r2_map = {}
            try:
                ged = ged_save.save_thread(os.path.dirname(spool_path), slug,
                                           ged_save.cfg_from_env(),
                                           env.get("GED_EMAIL_PREFIX") or "emails")
                entry["ged_uploaded"] = ged["count"]
                r2_map = {u.get("file"): u.get("key") for u in ged.get("uploaded", [])
                          if u.get("file") and u.get("key")}
            except RuntimeError as e:
                entry["errors"] += 1
                entry.setdefault("warn", []).append(f"ged: {e}")
            done_uids = []
            for m in mails:
                doc_meta = {"from": m["from"], "date": m["date_iso"],
                            "classification": m["role"], "pipeline_version": "m2.6",
                            "r2_key": r2_map.get("thread.json")}
                # D20: nettoie le contenu pour affichage webapp + RAG
                clean_content = clean_body.clean(m["new_content"])
                if not clean_content.strip():
                    clean_content = m["new_content"].strip()[
                        :2000] if m["new_content"] else ""
                m["new_content"] = clean_content
                try:
                    emb = embed_gemini.embed(m["new_content"], key_gemini,
                                             env.get("EMBED_MODEL") or "gemini-embedding-001",
                                             int(env.get("EMBED_MAX_CHARS") or 6000))
                    rpc("rpc_cap_doc_upsert", {
                        "p_kind": "email", "p_message_id": m["message_id"],
                        "p_content": m["new_content"], "p_embedding": emb["embedding"],
                        "p_thread_id": tid, "p_thread_role": m["role"],
                        "p_title": m["subject_raw"], "p_metadata": doc_meta}),
                    entry["docs_indexed"] += 1
                except (RuntimeError, ValueError) as e:
                    entry["errors"] += 1
                    entry.setdefault("warn", []).append(f"embed mail: {e}")
                rpc("rpc_cap_email_upsert", {
                    "p_message_id": m["message_id"], "p_thread_id": tid,
                    "p_thread_role": m["role"], "p_from_addr": m["from"],
                    "p_subject": m["subject_raw"], "p_status": "received",
                    "p_raw_metadata": doc_meta}),
                done_uids.append(m["uid"])
                for att in m["attachments"]:
                    path = att.get("path")
                    if not path or not os.path.isfile(path):
                        continue
                    entry["attachments_ocr"] += 1
                    if not path.lower().endswith((".pdf", ".png", ".jpg", ".jpeg", ".webp")):
                        continue
                    exs = []
                    for name, mod in (("gemini", ocr_gemini), ("openrouter", ocr_openrouter)):
                        if name == "openrouter" and not key_or:
                            continue
                        try:
                            ex = (ocr_gemini.extract(path, key_gemini) if name == "gemini"
                                  else mod.extract(path, key_or, or_model))
                            exs.append(dict(ex, extractor=name))
                        except RuntimeError as e:
                            entry.setdefault("warn", []).append(f"ocr {name}: {e}")
                    if not exs:
                        entry["errors"] += 1
                        entry.setdefault("warn", []).append(f"ocr {att['filename']}: 0 extracteur")
                        continue
                    if len(exs) == 1:
                        # 1 extracteur seul → juge en mode dégradé (D14)
                        exs.append({"extractor": "absent", "text": "",
                                    "doc_type_hint": "autre", "confidence": 0.0})
                    ex1, ex2 = exs[0], exs[1]
                    verdict = ocr_judge.judge(ex1, ex2)
                    # convention ged_save: att-{i+1}-{safe_name} — l'ordre des
                    # attachments (i) correspond exactement à l'ordre doc_upsert
                    r2_key_att = r2_map.get(f"att-{entry['attachments_ocr']}-{att.get('safe_name', '')}") \
                                 or r2_map.get("thread.json")
                    meta = {**doc_meta, "filename": att["filename"], "mime": att["mime"],
                            "ocr": {k: verdict[k] for k in
                                    ("winner", "agreement", "low_agreement", "doc_type")},
                            "r2_key": r2_key_att}
                    text = ex1["text"] if verdict["winner"] == "gemini" else ex2["text"]
                    if verdict["doc_type"] == "facture" and key_gemini:
                        try:
                            data = invoice_adapter.adapt(text, key_gemini)
                            check = invoice_check.run(data, tol)
                            sums, inv = check["sums"], check["invoice"]
                            conf = verdict["confidence"] * (0.6 if not sums["sums_ok"] else 1.0)
                            fr = rpc("rpc_cap_facture_upsert", {
                                "p_numero": inv.get("numero"),
                                "p_fournisseur": inv.get("fournisseur") or "",
                                "p_fournisseur_identifiant": inv.get("fournisseur_identifiant"),
                                "p_objet": inv.get("objet") or m["subject_raw"],
                                "p_date_facture": inv.get("date_facture"),
                                "p_date_echeance": inv.get("date_echeance"),
                                "p_montant_ht": inv.get("montant_ht"),
                                "p_montant_tva": inv.get("montant_tva"),
                                "p_montant_ttc": inv.get("montant_ttc"),
                                "p_devise": inv.get("devise") or "EUR",
                                "p_confiance": conf,
                                "p_email_message_id": m["message_id"],
                                "p_extraction": {**inv, "sums": sums, "judge": meta["ocr"]}})
                            entry["factures"] += 1
                            entry.setdefault("facture_detail", []).append(
                                {"numero": inv.get("numero"), "action": fr.get("action"),
                                 "sums_ok": sums["sums_ok"]})
                        except (RuntimeError, ValueError) as e:
                            entry["errors"] += 1
                            entry.setdefault("warn", []).append(f"facture: {e}")
                    try:
                        emb_att = embed_gemini.embed(text, key_gemini,
                                                     env.get("EMBED_MODEL") or "gemini-embedding-001",
                                                     int(env.get("EMBED_MAX_CHARS") or 6000))
                        rpc("rpc_cap_doc_upsert", {
                            "p_kind": "attachment", "p_message_id": m["message_id"],
                            "p_content": text, "p_embedding": emb_att["embedding"],
                            "p_thread_id": tid, "p_parent_message_id": m["message_id"],
                            "p_title": att["filename"],
                            "p_metadata": meta}),
                        entry["docs_indexed"] += 1
                    except (RuntimeError, ValueError) as e:
                        entry["errors"] += 1
                        entry.setdefault("warn", []).append(f"embed PJ: {e}")
                new_uids = [str(m["uid"]) for m in thread["messages"]
                            if m["message_id"] in {x["message_id"] for x in mails_new}
                            and m.get("uid")]
                if new_uids and not dry:
                    md = imap_mark_done.label_and_delete(
                        cfg={"VPS_GMAIL_RECEPTION_IMAP_ADRESS": env.get("VPS_GMAIL_RECEPTION_IMAP_ADRESS"),
                             "VPS_GMAIL_RECEPTION_IMAP_MDP": env.get("VPS_GMAIL_RECEPTION_IMAP_MDP"),
                             "GMAIL_LABEL_DONE": env.get("GMAIL_LABEL_DONE") or "ia-traite"},
                        uids=new_uids)
                    entry["labeled"] = md["moved"]
            result["processed"] += 1
            result["threads"].append(entry)
        except Exception as e:
            import traceback as tb
            entry["errors"] += 1
            tb_str = traceback.format_exc()
            entry["error"] = (str(e) + " | TRACEBACK:" + tb_str[:600])[:800]
            result["threads"].append(entry)
            result["errors"].append(f"{tid}: {e}")
    try:
        rpc("rpc_cap_pipeline_log", {
            "p_trigger": "run_pipeline", "p_threads_seen": poll["count"],
            "p_mails_new": sum(t.get("mails_new", 0) for t in result["threads"]),
            "p_mails_known": sum(t.get("mails_known", 0) for t in result["threads"]),
            "p_attachments_ocr": sum(t.get("attachments_ocr", 0) for t in result["threads"]),
            "p_docs_indexed": sum(t.get("docs_indexed", 0) for t in result["threads"]),
            "p_factures_upserted": sum(t.get("factures", 0) for t in result["threads"]),
            "p_errors": sum(t.get("errors", 0) for t in result["threads"]),
            "p_last_error": "; ".join(result["errors"])[:300] or None})
    except RuntimeError as e:
        result["errors"].append(f"pipeline_log: {e}")
    return result


def main():
    max_threads, dry, force_att = 5, False, False
    args = sys.argv[1:]
    if "--max-threads" in args:
        max_threads = int(args[args.index("--max-threads") + 1])
    dry = "--dry-run" in args
    force_att = "--force-attachments" in args
    missing = [k for k in ("CLIENT_SLUG", "CLIENT_RPC_SECRET",
                           "VPS_SUPERBASE_VPS_DB_PROJECT_URL",
                           "VPS_SUPERBASE_VPS_DB_RPC_KEY",
                           "VPS_GMAIL_RECEPTION_IMAP_ADRESS",
                           "VPS_GMAIL_RECEPTION_IMAP_MDP") if not os.environ.get(k)]
    if missing:
        print(json.dumps({"error": "env manquante", "vars": missing}), file=sys.stderr)
        return 2
    print(json.dumps(run(max_threads, dry, force_att), ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
