"""Text extraction (PDF text layer, OCR for images and scanned PDFs) and field parsing."""
import io
import re
from pathlib import Path

OCR_LANGS = "eng+tam"


class OcrUnavailable(RuntimeError):
    pass


def _ocr_image(img) -> tuple[str, float]:
    try:
        import pytesseract
        from pytesseract import Output, TesseractNotFoundError
    except ImportError as e:  # pragma: no cover
        raise OcrUnavailable("pytesseract is not installed") from e
    try:
        d = pytesseract.image_to_data(img, lang=OCR_LANGS, output_type=Output.DICT)
    except TesseractNotFoundError as e:
        raise OcrUnavailable("Tesseract OCR engine is not installed on the server") from e
    except pytesseract.TesseractError as e:
        raise OcrUnavailable(f"OCR failed (are the eng+tam language packs installed?): {str(e)[:120]}") from e
    words = [(w, float(c)) for w, c in zip(d["text"], d["conf"]) if w.strip() and float(c) >= 0]
    text = pytesseract.image_to_string(img, lang=OCR_LANGS)
    conf = sum(c for _, c in words) / len(words) / 100 if words else 0.0
    return text, round(conf, 2)


def extract_text(path: Path, mime: str) -> tuple[str, float | None, str]:
    """Returns (text, ocr_confidence | None, status)."""
    if mime == "text/plain":
        return path.read_text("utf-8", errors="replace"), None, "extracted"

    if mime == "application/pdf":
        from pypdf import PdfReader

        text = "\n".join((p.extract_text() or "") for p in PdfReader(str(path)).pages)
        if len(re.sub(r"\s", "", text)) >= 40:
            return text, None, "extracted"
        # Scanned PDF: rasterise pages and OCR them (needs poppler + tesseract on the server).
        try:
            from pdf2image import convert_from_path

            pages = convert_from_path(str(path), dpi=200, first_page=1, last_page=10)
            parts = [_ocr_image(p) for p in pages]
        except (OcrUnavailable, Exception) as e:  # noqa: BLE001 - poppler missing etc.
            if isinstance(e, OcrUnavailable) or "poppler" in str(e).lower() or "Unable to get page count" in str(e):
                return "", None, "needs_ocr"
            raise
        text = "\n".join(t for t, _ in parts)
        conf = sum(c for _, c in parts) / len(parts) if parts else 0.0
        return text, round(conf, 2), "extracted" if text.strip() else "needs_ocr"

    from PIL import Image

    with Image.open(path) as img:
        text, conf = _ocr_image(img.convert("RGB"))
    return text, conf, "extracted"


# ---------- units ----------
_SQFT = {"sqft": 1, "sqm": 10.7639, "acre": 43560, "cent": 435.6, "ground": 2400, "hectare": 107639}


def _unit_key(u: str) -> str | None:
    u = re.sub(r"[\s.]", "", u.lower())
    for prefix, key in (("sqf", "sqft"), ("squarefeet", "sqft"), ("sqm", "sqm"), ("acre", "acre"), ("cent", "cent"), ("ground", "ground"), ("hect", "hectare")):
        if u.startswith(prefix):
            return key
    return None


def extent_to_sqft(value: str, unit: str) -> float | None:
    k = _unit_key(unit)
    try:
        n = float(value.replace(",", ""))
    except ValueError:
        return None
    return round(n * _SQFT[k], 2) if k else None


def norm_survey(s: str) -> str:
    return re.sub(r"\s+", "", s).upper()


# ---------- field parsing ----------
_I = re.I | re.M
PATTERNS: list[tuple[str, str, re.Pattern]] = [
    ("survey_no", "Survey number", re.compile(r"(?:survey\s*(?:no\.?|number)|\bs\.?\s*no\.?|சர்வே\s*எண்|புல\s*எண்)\s*[:\-]?\s*(\d+(?:\s*/\s*\d+[A-Za-z]?)?[A-Za-z]?)", _I)),
    ("owner", "Owner / seller", re.compile(r"(?:seller|vendor|owner|pattadar|patta\s*holder|பட்டாதாரர்|விற்பனையாளர்)(?:\s*name)?\s*[:\-]\s*([A-Za-z][A-Za-z .]{2,60}?)(?=\s{2,}|\n|,|;|$)", _I)),
    ("village", "Village", re.compile(r"(?:village|கிராமம்)\s*[:\-]\s*([A-Za-z][A-Za-z ]{2,40}?)(?=\s{2,}|\n|,|;|$)", _I)),
    ("doc_no", "Document number", re.compile(r"doc(?:ument)?\.?\s*(?:no\.?|number)\s*[:\-]?\s*(\d+\s*/\s*\d{4})", _I)),
    ("reg_date", "Registration date", re.compile(r"(?:registered\s*on|registration\s*date|date\s*of\s*registration)\s*[:\-]?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})", _I)),
    ("approval_ref", "Approval reference", re.compile(r"\b((?:DTCP|CMDA)\s*/\s*[A-Z]{1,3}\s*(?:No\.?)?\s*\d+\s*/\s*\d{4})", _I)),
]
EXTENT_RE = re.compile(r"(?:extent|area|விஸ்தீர்ணம்|பரப்பு)\s*[:\-]?\s*([0-9][0-9,]*\.?[0-9]*)\s*(sq\.?\s*ft|sq\.?\s*feet|square\s*feet|sq\.?\s*m|acres?|cents?|grounds?|hectares?)", _I)


def parse_fields(text: str, ocr_confidence: float | None) -> list[dict]:
    """Pattern-based candidates. Every field must be confirmed by the user (confirmed=False)."""
    conf = round(min(ocr_confidence if ocr_confidence is not None else 0.85, 0.9), 2)
    snip = lambda m: re.sub(r"\s+", " ", text[max(0, m.start() - 10): m.end() + 20]).strip()  # noqa: E731
    out = []
    for key, label, rx in PATTERNS:
        if m := rx.search(text):
            out.append({"key": key, "label": label, "value": m.group(1).strip(), "confidence": conf, "snippet": snip(m), "confirmed": False})
    if m := EXTENT_RE.search(text):
        if sqft := extent_to_sqft(m.group(1), m.group(2)):
            out.append({"key": "extent", "label": "Extent", "value": f"{m.group(1)} {m.group(2)}", "sqft": sqft, "confidence": conf, "snippet": snip(m), "confirmed": False})
    return out
