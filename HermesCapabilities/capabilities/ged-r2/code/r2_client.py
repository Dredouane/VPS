#!/usr/bin/env python3
"""HermesCapabilities — ged-r2 — client Cloudflare R2 S3-compatible (stdlib).

Signature AWS SigV4 implémentée avec hmac/hashlib (AUCUNE dépendance pip,
invariant I11). Région R2 = 'auto'. Session token optionnel
(VPS_GED_CLOUDFLARE_TOKEN) → header x-amz-security-token.

Fonctions : put_object(bucket, key, data), get_object(bucket, key),
delete_object(bucket, key), head_object. Pures : sigv4_headers, object_url.
Testées contre le vecteur officiel AWS SigV4 (test suite).
"""
import datetime
import hashlib
import hmac
import urllib.parse
import urllib.request

DEFAULT_REGION = "auto"
DEFAULT_SERVICE = "s3"


# ─────────────────────────────── SigV4 (purs) ────────────────────────────────
def _hmac(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def sigv4_headers(method: str, url: str, payload: bytes,
                  access_key: str, secret_key: str, session_token: str = None,
                  region: str = DEFAULT_REGION, service: str = DEFAULT_SERVICE,
                  amzdate: str = None, s3: bool = True) -> dict:
    """Headers SigV4 (pur — amzdate injectable pour tests).
    s3=True : x-amz-content-sha256 signé (requis par R2/S3, validé en réel).
    s3=False : variante suite de tests AWS officielle (vector 5fa00fa3…)."""
    u = urllib.parse.urlparse(url)
    host = u.netloc
    path = urllib.parse.quote(u.path or "/", safe="/-._~")
    now = datetime.datetime.strptime(amzdate, "%Y%m%dT%H%M%SZ").replace(
        tzinfo=datetime.timezone.utc) if amzdate else datetime.datetime.now(datetime.timezone.utc)
    amzdate = amzdate or now.strftime("%Y%m%dT%H%M%SZ")
    datestamp = now.strftime("%Y%m%d")
    payload_hash = hashlib.sha256(payload or b"").hexdigest()

    headers = {"host": host, "x-amz-date": amzdate}
    if s3:
        headers["x-amz-content-sha256"] = payload_hash
    if session_token:
        headers["x-amz-security-token"] = session_token
    signed_headers = ";".join(sorted(headers))
    canonical_headers = "".join(f"{k}:{headers[k]}\n" for k in sorted(headers))
    canonical_query = u.query  # GET sans query dans notre usage

    canonical_request = (f"{method}\n{path}\n{canonical_query}\n"
                         f"{canonical_headers}\n{signed_headers}\n{payload_hash}")
    scope = f"{datestamp}/{region}/{service}/aws4_request"
    string_to_sign = (f"AWS4-HMAC-SHA256\n{amzdate}\n{scope}\n"
                      f"{hashlib.sha256(canonical_request.encode()).hexdigest()}")
    k = _hmac(_hmac(_hmac(_hmac(("AWS4" + secret_key).encode(), datestamp),
                    region), service), "aws4_request")
    signature = hmac.new(k, string_to_sign.encode(), hashlib.sha256).hexdigest()
    authorization = (f"AWS4-HMAC-SHA256 Credential={access_key}/{scope}, "
                     f"SignedHeaders={signed_headers}, Signature={signature}")
    out = {"Authorization": authorization, "x-amz-date": amzdate,
           "x-amz-content-sha256": payload_hash}
    if session_token:
        out["x-amz-security-token"] = session_token
    return out


def object_url(endpoint: str, bucket: str, key: str) -> str:
    """URL path-style : <endpoint>/<bucket>/<key> (clé encodée par segment)."""
    key = "/".join(urllib.parse.quote(s, safe="/-._~") for s in key.split("/"))
    return f"{endpoint.rstrip('/')}/{bucket.strip('/')}/{key.lstrip('/')}"


# ─────────────────────────────── I/O (mince) ─────────────────────────────────
# NB: VPS_GED_CLOUDFLARE_TOKEN est un token API Cloudflare (REST) — il n'est
# PAS un session token S3 : R2 rejette x-amz-security-token (vérifié 01/09).
# L'auth S3 = ACCESS_KEY_ID + SECRET uniquement.
def _request(method: str, url: str, payload: bytes, cfg: dict):
    cfg.setdefault("region", DEFAULT_REGION)
    headers = sigv4_headers(method, url, payload,
                            cfg["VPS_GED_CLOUDFLARE_ACCESS_KEY_ID"],
                            cfg["VPS_GED_CLOUDFLARE_SECRET_ACCESS_KEY"],
                            None, cfg.get("region", DEFAULT_REGION))
    req = urllib.request.Request(url, data=payload if method in ("PUT", "POST") else None,
                                 headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def put_object(endpoint: str, bucket: str, key: str, data: bytes, cfg: dict) -> int:
    url = object_url(endpoint, bucket, key)
    status, _ = _request("PUT", url, data, cfg)
    if status not in (200, 201):
        raise RuntimeError(f"R2 PUT {status}: {key}")
    return status


def get_object(endpoint: str, bucket: str, key: str, cfg: dict) -> bytes:
    url = object_url(endpoint, bucket, key)
    status, body = _request("GET", url, b"", cfg)
    if status != 200:
        raise RuntimeError(f"R2 GET {status}: {key}")
    return body


def head_object(endpoint: str, bucket: str, key: str, cfg: dict) -> bool:
    url = object_url(endpoint, bucket, key)
    status, _ = _request("HEAD", url, b"", cfg)
    return status == 200


def delete_object(endpoint: str, bucket: str, key: str, cfg: dict) -> int:
    url = object_url(endpoint, bucket, key)
    status, _ = _request("DELETE", url, b"", cfg)
    if status not in (200, 204, 404):   # 404 = déjà absent → idempotent
        raise RuntimeError(f"R2 DELETE {status}: {key}")
    return status
