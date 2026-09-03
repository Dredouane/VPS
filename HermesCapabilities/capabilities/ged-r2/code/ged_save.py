#!/usr/bin/env python3
"""HermesCapabilities — ged-r2 — sauvegarde des fichiers bruts email (R2).

Appelé GÉNÉRIQUEMENT à la fin d'une extraction email (après imap_poll) :
upload tout le contenu du dossier thread du spool (thread.json + pièces
jointes) vers R2, clé : <GED_EMAIL_PREFIX>/<slug>/emails/<thread_id>/<fichier>
(le slug distingue les clients — exigence 01/09).

Usage : python3 ged_save.py <spool_thread_dir>
Entrée : env VPS_GED_CLOUDFLARE_* (endpoint, bucket, clés). Exit 0/2/3.
Sortie : JSON {"uploaded": [{key, size}], "bucket", "prefix"}.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import r2_client  # noqa: E402

REQUIRED_ENV = ("VPS_GED_CLOUDFLARE_S3_EU_ENDPOINT",
                "VPS_GED_CLOUDFLARE_BUCKET_NAME",
                "VPS_GED_CLOUDFLARE_ACCESS_KEY_ID",
                "VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY")


def object_key(prefix: str, slug: str, thread_id: str, filename: str) -> str:
    """Clé R2 déterministe (pur, testable)."""
    prefix = (prefix or "emails").strip("/")
    return f"{prefix}/{slug}/emails/{thread_id}/{os.path.basename(filename)}"


def cfg_from_env() -> dict:
    cfg = {k: os.environ.get(k, "") for k in REQUIRED_ENV}
    cfg["VPS_GED_CLOUDFLARE_TOKEN"] = os.environ.get("VPS_GED_CLOUDFLARE_TOKEN", "")
    missing = [k for k in REQUIRED_ENV if not cfg[k]]
    if missing:
        raise RuntimeError(f"config manquante: {missing}")
    return cfg


def save_thread(thread_dir: str, slug: str, cfg: dict, prefix: str = "emails") -> dict:
    """Upload tous les fichiers d'un dossier thread (récursif léger)."""
    thread_id = os.path.basename(os.path.normpath(thread_dir))
    uploaded, errors = [], []
    for root, _, files in os.walk(thread_dir):
        for fn in sorted(files):
            path = os.path.join(root, fn)
            rel = os.path.relpath(path, thread_dir)
            key = object_key(prefix, slug, thread_id, rel.replace(os.sep, "/"))
            with open(path, "rb") as f:
                data = f.read()
            try:
                r2_client.put_object(cfg["VPS_GED_CLOUDFLARE_S3_EU_ENDPOINT"],
                                     cfg["VPS_GED_CLOUDFLARE_BUCKET_NAME"],
                                     key, data, cfg)
                uploaded.append({"key": key, "size": len(data)})
            except RuntimeError as e:
                errors.append(str(e))
    return {"uploaded": uploaded, "errors": errors, "count": len(uploaded),
            "bucket": cfg["VPS_GED_CLOUDFLARE_BUCKET_NAME"], "prefix": prefix,
            "thread_id": thread_id}


def main() -> int:
    if len(sys.argv) < 2 or not os.path.isdir(sys.argv[1]):
        print("usage: ged_save.py <spool_thread_dir>", file=sys.stderr)
        return 1
    slug = os.environ.get("CLIENT_SLUG", "")
    if not slug:
        print(json.dumps({"error": "CLIENT_SLUG absente"}), file=sys.stderr)
        return 2
    prefix = os.environ.get("GED_EMAIL_PREFIX", "emails")
    try:
        cfg = cfg_from_env()
        result = save_thread(sys.argv[1], slug, cfg, prefix)
    except RuntimeError as e:
        low = str(e).lower()
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        return 2 if "config" in low or "auth" in low else 3
    print(json.dumps(result, ensure_ascii=False))
    return 0 if not result["errors"] else 3


if __name__ == "__main__":
    sys.exit(main())
