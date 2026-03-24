from __future__ import annotations

import base64
import binascii
import io
from typing import Any


def decode_resume_file_bytes(resume_payload: dict[str, Any]) -> bytes:
    file_data = str((resume_payload or {}).get("fileData") or "").strip()
    if not file_data:
        return b""

    encoded = file_data.split(",", 1)[1] if "," in file_data else file_data
    try:
        return base64.b64decode(encoded)
    except (ValueError, binascii.Error):
        return b""


def normalize_resume_text(text: str) -> str:
    return " ".join(str(text or "").split()).strip()


def _text_signal_score(text: str) -> int:
    normalized = normalize_resume_text(text)
    if not normalized:
        return -1

    alpha_chars = sum(1 for char in normalized if char.isalpha())
    word_like_tokens = sum(1 for token in normalized.split() if any(char.isalpha() for char in token))
    return alpha_chars + (word_like_tokens * 4)


def _extract_page_text(page: Any) -> str:
    attempts = (
        {},
        {"extraction_mode": "layout"},
        {"layout_mode_space_vertically": False},
        {"extraction_mode": "layout", "layout_mode_space_vertically": False},
    )

    best_text = ""
    best_score = -1
    for kwargs in attempts:
        try:
            candidate = page.extract_text(**kwargs) or ""
        except Exception:
            continue

        normalized = normalize_resume_text(candidate)
        score = _text_signal_score(normalized)
        if score > best_score:
            best_text = normalized
            best_score = score

    return best_text


def extract_resume_text(resume_payload: dict[str, Any], max_pages: int = 6) -> str:
    file_bytes = decode_resume_file_bytes(resume_payload)
    if not file_bytes:
        return ""

    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:
        return ""

    try:
        reader = PdfReader(io.BytesIO(file_bytes))
    except Exception:
        return ""

    extracted_pages: list[str] = []
    for index, page in enumerate(reader.pages):
        if index >= max_pages:
            break
        page_text = _extract_page_text(page)
        if page_text:
            extracted_pages.append(page_text)

    return normalize_resume_text(" ".join(extracted_pages))


def extract_resume_text_excerpt(
    resume_payload: dict[str, Any],
    max_chars: int = 3000,
    max_pages: int = 8,
) -> str:
    return extract_resume_text(resume_payload, max_pages=max_pages)[:max_chars]
