import json

import httpx

from ..config import settings
from .rules import DOC_TYPES

SYSTEM = """You are the assistant inside a Tamil Nadu land-audit tool. Answer ONLY from the CASE DATA provided.
Rules: never invent facts, laws, or document contents; if the data does not say, say it is not in the evidence and what document would show it.
Extracted values marked confirmed=false are machine-read candidates - say so. Findings are risk indicators, not legal conclusions.
You are not a lawyer: for legal decisions recommend a qualified advocate / surveyor. Reply in the user's language (Tamil or English), concisely."""


class AIError(RuntimeError):
    pass


def configured() -> bool:
    return bool(settings.anthropic_api_key)


def case_context(case_out: dict) -> str:
    c = case_out
    return json.dumps({
        "case": {k: c[k] for k in ("id", "title", "district", "village", "survey_no")},
        "score": c["score"],
        "documents": [{"type": DOC_TYPES.get(d["type"]), "status": d["status"], "fields": [{k: f.get(k) for k in ("label", "value", "confirmed", "snippet")} for f in d["fields"]]} for d in c["documents"]],
        "findings": [{k: f[k] for k in ("severity", "title", "detail", "action", "evidence")} for f in c["findings"] if f["status"] != "dismissed"],
        "nearby_osm": (c["geo"]["items"][:15] if c.get("geo") else "location not set"),
        "not_connected": ["TNREGINET", "DTCP", "CMDA", "TNGIS", "flood/groundwater/CRZ layers"],
    }, ensure_ascii=False)


def chat(case_out: dict, history: list[dict]) -> str:
    try:
        r = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": settings.anthropic_api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
            json={"model": settings.anthropic_model, "max_tokens": 1000, "system": f"{SYSTEM}\n\nCASE DATA:\n{case_context(case_out)}", "messages": history[-20:]},
            timeout=60,
        )
        r.raise_for_status()
    except httpx.HTTPError as e:
        raise AIError(f"AI provider error: {e}") from e
    return "\n".join(b["text"] for b in r.json()["content"] if b["type"] == "text")
