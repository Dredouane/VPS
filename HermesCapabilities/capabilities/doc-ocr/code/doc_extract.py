#!/usr/bin/env python3
"""HermesCapabilities — doc-ocr — extraction documentaire multi-types (D21).

Extraction déterministe (sans LLM) du texte de documents Office/CSV/TXT.
Les PDF/images restent gérés par les OCR vision (Gemini/OpenRouter).

Entrée : chemin d'un fichier (spool)
Sortie : {"text", "doc_type_hint", "confidence", "method"}

Types supportés : xlsx, xls, docx, pptx, csv, txt, md, log
Types NON supportés → logging pipeline_runs + skip (pas de crash).

Déterministe, stdlib + openpyxl/python-docx/python-pptx.
"""
import csv
import io
import os
import re
import sys

# ─── Extraction xlsx/xls ─────────────────────────────────────────────────────

def _extract_xlsx(path: str) -> dict:
    """Extraction cellules xlsx → texte tabulaire structuré."""
    try:
        import openpyxl
    except ImportError:
        return {"text": "", "doc_type_hint": "autre", "confidence": 0.0,
                "method": "openpyxl_missing"}
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    lines = []
    for ws in wb.worksheets:
        for row in ws.iter_rows(values_only=True):
            cells = [str(c).strip() for c in row if c is not None and str(c).strip()]
            if cells:
                lines.append(" | ".join(cells))
    wb.close()
    text = "\n".join(lines).strip()
    hint = _guess_hint_from_text(text)
    return {"text": text, "doc_type_hint": hint,
            "confidence": 0.9 if text else 0.0, "method": "openpyxl"}


def _extract_xls(path: str) -> dict:
    """Extraction xls via openpyxl (si xlrd absent, fallback)."""
    try:
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        lines = []
        for ws in wb.worksheets:
            for row in ws.iter_rows(values_only=True):
                cells = [str(c).strip() for c in row if c is not None and str(c).strip()]
                if cells:
                    lines.append(" | ".join(cells))
        wb.close()
        text = "\n".join(lines).strip()
        return {"text": text, "doc_type_hint": _guess_hint_from_text(text),
                "confidence": 0.85 if text else 0.0, "method": "openpyxl"}
    except Exception:
        pass
    # fallback: lecture brute
    return _read_text_fallback(path, "xls_fallback")

# ─── Extraction docx ─────────────────────────────────────────────────────────

def _extract_docx(path: str) -> dict:
    """Extraction paragraphes + tableaux docx → texte."""
    try:
        import docx
    except ImportError:
        return {"text": "", "doc_type_hint": "autre", "confidence": 0.0,
                "method": "python-docx_missing"}
    doc = docx.Document(path)
    lines = []
    # paragraphes
    for para in doc.paragraphs:
        t = para.text.strip()
        if t:
            lines.append(t)
    # tableaux
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                lines.append(" | ".join(cells))
    text = "\n".join(lines).strip()
    hint = _guess_hint_from_text(text)
    return {"text": text, "doc_type_hint": hint,
            "confidence": 0.9 if text else 0.0, "method": "python-docx"}

# ─── Extraction pptx ─────────────────────────────────────────────────────────

def _extract_pptx(path: str) -> dict:
    """Extraction slides pptx → texte séquencé."""
    try:
        import pptx
    except ImportError:
        return {"text": "", "doc_type_hint": "autre", "confidence": 0.0,
                "method": "python-pptx_missing"}
    prs = pptx.Presentation(path)
    lines = []
    for i, slide in enumerate(prs.slides, 1):
        slide_lines = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                slide_lines.append(shape.text.strip())
        if slide_lines:
            lines.append(f"--- Slide {i} ---")
            lines.extend(slide_lines)
    text = "\n".join(lines).strip()
    return {"text": text, "doc_type_hint": "autre",
            "confidence": 0.85 if text else 0.0, "method": "python-pptx"}

# ─── Extraction csv ───────────────────────────────────────────────────────────

def _extract_csv(path: str) -> dict:
    """Lecture csv → texte structuré."""
    text = ""
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            with open(path, "r", encoding=enc, errors="strict") as f:
                reader = csv.reader(f)
                rows = []
                for row in reader:
                    cells = [c.strip() for c in row if c.strip()]
                    if cells:
                        rows.append(" | ".join(cells))
                text = "\n".join(rows).strip()
                break
        except (UnicodeDecodeError, UnicodeError):
            continue
    return {"text": text, "doc_type_hint": "autre",
            "confidence": 0.9 if text else 0.0, "method": "csv"}

# ─── Extraction texte brut ───────────────────────────────────────────────────

def _extract_text(path: str) -> dict:
    """Lecture texte brut (txt, md, log)."""
    for enc in ("utf-8", "latin-1", "cp1252"):
        try:
            with open(path, "r", encoding=enc, errors="strict") as f:
                text = f.read().strip()
                return {"text": text, "doc_type_hint": _guess_hint_from_text(text),
                        "confidence": 0.95 if text else 0.0, "method": "text"}
        except (UnicodeDecodeError, UnicodeError):
            continue
    return _read_text_fallback(path, "text_fallback")


def _read_text_fallback(path: str, method: str) -> dict:
    """Dernier recours: lecture brute binaire → strip."""
    try:
        with open(path, "rb") as f:
            raw = f.read()
        text = raw.decode("utf-8", errors="replace").strip()
        return {"text": text, "doc_type_hint": "autre",
                "confidence": 0.3 if text else 0.0, "method": method}
    except Exception:
        return {"text": "", "doc_type_hint": "autre",
                "confidence": 0.0, "method": f"{method}_failed"}

# ─── Heuristiques ─────────────────────────────────────────────────────────────

RE_FACTURE_KW = re.compile(
    r"facture|tva|montant\s+(total|ht|ttc)|total\s+(ht|ttc)|echeance|t\d+\s*:\s*\d", re.I)
RE_DEVIS_KW = re.compile(r"devis|estimation|proposition\s+commerciale", re.I)
RE_PLAN_KW = re.compile(r"plan|masse|cote|echelle|architecte", re.I)
RE_COURRIER_KW = re.compile(r"objet\s*:|madame|monsieur|cordialement|vi[lr]e", re.I)


def _guess_hint_from_text(text: str) -> str:
    """Guess doc_type_hint depuis le texte extrait (déterministe)."""
    t = (text or "")[:2000].lower()
    if not t.strip():
        return "autre"
    facture_score = len(RE_FACTURE_KW.findall(t))
    devis_score = len(RE_DEVIS_KW.findall(t))
    plan_score = len(RE_PLAN_KW.findall(t))
    courrier_score = len(RE_COURRIER_KW.findall(t))
    best = max(facture_score, devis_score, plan_score, courrier_score)
    if best == 0:
        return "autre"
    if facture_score == best:
        return "facture"
    if devis_score == best:
        return "devis"
    if plan_score == best:
        return "plan"
    return "courrier"

# ─── API publique ─────────────────────────────────────────────────────────────

# Extensions supportées par extraction déterministe (sans OCR vision)
EXTRACT_EXTENSIONS = {
    ".xlsx": _extract_xlsx,
    ".xls": _extract_xls,
    ".docx": _extract_docx,
    ".pptx": _extract_pptx,
    ".csv": _extract_csv,
    ".txt": _extract_text,
    ".md": _extract_text,
    ".log": _extract_text,
}

# Extensions qui passent par OCR vision (pas ici)
OCR_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


def extract(path: str) -> dict:
    """Point d'entrée unique. Fichier → contrat générique.

    Retourne {"text", "doc_type_hint", "confidence", "method"}.
    Si le type n'est pas supporté, retourne un dict avec text="" et
    method="unsupported" — l'appelant loggue dans pipeline_runs.
    """
    if not path or not os.path.isfile(path):
        return {"text": "", "doc_type_hint": "autre", "confidence": 0.0,
                "method": "missing_file"}
    ext = os.path.splitext(path)[1].lower()
    if ext in OCR_EXTENSIONS:
        # Ne devrait pas être appelé pour les types OCR — mais fallback propre
        return {"text": "", "doc_type_hint": "autre", "confidence": 0.0,
                "method": "ocr_type_should_use_vision"}
    handler = EXTRACT_EXTENSIONS.get(ext)
    if not handler:
        return {"text": "", "doc_type_hint": "autre", "confidence": 0.0,
                "method": f"unsupported_{ext.lstrip('.')}"}
    try:
        return handler(path)
    except Exception as e:
        return {"text": "", "doc_type_hint": "autre", "confidence": 0.0,
                "method": f"error_{ext.lstrip('.')}:{str(e)[:80]}"}


def is_supported(path: str) -> bool:
    """True si le fichier peut être extrait (Office/CSV/TXT)."""
    ext = os.path.splitext(path or "")[1].lower()
    return ext in EXTRACT_EXTENSIONS


def is_ocr_type(path: str) -> bool:
    """True si le fichier doit passer par OCR vision."""
    ext = os.path.splitext(path or "")[1].lower()
    return ext in OCR_EXTENSIONS


def main() -> int:
    if len(sys.argv) < 2 or not os.path.isfile(sys.argv[1]):
        print("usage: doc_extract.py <fichier>", file=sys.stderr)
        return 1
    result = extract(sys.argv[1])
    import json
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["text"] else 2


if __name__ == "__main__":
    sys.exit(main())
