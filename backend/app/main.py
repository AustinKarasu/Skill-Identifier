from __future__ import annotations

import base64
import binascii
import hmac
import json
import io
import secrets
import struct
import time
import urllib.parse
import urllib.request
import os
import smtplib
import ssl
import threading
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from typing import Any
from uuid import uuid4

from contextvars import ContextVar
from fastapi import Cookie, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response
from email.message import EmailMessage
from email.utils import formataddr
from sqlalchemy import func, select

from .config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    OPENAI_API_KEY,
    OPENAI_MODEL,
    RECAPTCHA_SECRET_KEY,
    RESUME_PARSER_API_KEY,
    RESUME_PARSER_API_URL,
    RESUME_PARSER_PROVIDER,
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
)
from .database import (
    AppStateRecord,
    AssessmentRecord,
    AssessmentAttemptRecord,
    AssessmentTemplateRecord,
    EmployeeRecord,
    FeedbackSurveyRecord,
    ManagerCommunicationRecord,
    ManagerInterviewScheduleRecord,
    NotificationRecord,
    RubricTemplateRecord,
    RoleRecord,
    SettingsRecord,
    TeamRecord,
    UserRecord,
    db_session,
    dumps_json,
    get_database_mode,
    get_state,
    init_database,
    loads_json,
    set_state,
)
from .evaluation import DOMAIN_KEYWORDS, build_questions, evaluate_interview
from .resume_pdf import extract_resume_text, extract_resume_text_excerpt
from .seed_data import DEFAULT_EMPLOYEE_JOURNEY, DEFAULT_SETTINGS, DEFAULT_STORE, hash_password

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas


TWO_FACTOR_TTL_SECONDS = 600
FAST_CACHE: dict[str, tuple[float, Any]] = {}
TWO_FACTOR_CHALLENGES: dict[str, dict[str, Any]] = {}
ACTIVE_SESSIONS: dict[str, dict[str, Any]] = {}
SESSION_COOKIE_NAME = "session_token"
SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
REQUEST_SESSION_TOKEN: ContextVar[str | None] = ContextVar("request_session_token", default=None)
INTERVIEW_CHAT_SESSIONS: dict[str, dict[str, Any]] = {}
TOTP_WINDOW = 1  # accept codes one step before/after
INTERVIEW_RETENTION_WINDOWS = {
    "24h": timedelta(hours=24),
    "48h": timedelta(hours=48),
    "1week": timedelta(weeks=1),
    "1month": timedelta(days=30),
    "3month": timedelta(days=90),
}
SETTINGS_SECTIONS = ("profile", "preferences", "localization", "privacy", "security", "appearance")
SETTINGS_FIELD_ALLOWLIST: dict[str, set[str]] = {
    "profile": {"name", "email", "title", "phone", "department", "manager", "photoData"},
    "preferences": {"emailAlerts", "assessmentNotifications", "weeklyReport", "pushNotifications"},
    "localization": {"language", "timezone", "dateFormat"},
    "privacy": {"profileVisibility", "shareAssessments", "shareSkills", "allowTracking"},
    "security": {"twoFactorRequired", "sessionTimeoutMinutes", "lastPasswordChange"},
    "appearance": {"theme", "accentColor", "fontSize"},
}

JOB_MATCH_SKILL_LIBRARY: dict[str, tuple[str, ...]] = {
    "React": ("react", "react.js"),
    "Next.js": ("next.js", "nextjs"),
    "Vue": ("vue", "vue.js"),
    "Angular": ("angular",),
    "JavaScript": ("javascript",),
    "TypeScript": ("typescript",),
    "HTML": ("html",),
    "CSS": ("css", "tailwind css", "tailwind"),
    "Accessibility": ("accessibility", "a11y"),
    "Responsive Design": ("responsive design",),
    "Node.js": ("node.js", "nodejs"),
    "Express": ("express", "express.js"),
    "Python": ("python",),
    "FastAPI": ("fastapi",),
    "Java": ("java",),
    "Spring Boot": ("spring boot", "springboot"),
    "REST APIs": ("rest api", "rest apis", "api development"),
    "GraphQL": ("graphql",),
    "Microservices": ("microservices", "microservice"),
    "Authentication": ("authentication", "auth"),
    "PostgreSQL": ("postgresql", "postgres"),
    "MySQL": ("mysql",),
    "MongoDB": ("mongodb", "mongo db"),
    "Redis": ("redis",),
    "SQL": ("sql",),
    "Docker": ("docker",),
    "Kubernetes": ("kubernetes", "k8s"),
    "CI/CD": ("ci/cd", "ci cd", "continuous integration", "continuous delivery"),
    "GitHub Actions": ("github actions",),
    "AWS": ("aws", "amazon web services"),
    "Azure": ("azure",),
    "GCP": ("gcp", "google cloud"),
    "Terraform": ("terraform",),
    "Linux": ("linux",),
    "Pandas": ("pandas",),
    "NumPy": ("numpy",),
    "Machine Learning": ("machine learning", "ml"),
    "Prompt Engineering": ("prompt engineering",),
    "LLM Apps": ("llm", "large language model", "ai application"),
    "Vector Databases": ("vector database", "vector db", "embedding"),
    "ETL": ("etl", "data pipeline"),
    "Playwright": ("playwright",),
    "Cypress": ("cypress",),
    "Selenium": ("selenium",),
    "Unit Testing": ("unit testing", "unit tests"),
    "Performance Testing": ("performance testing",),
    "OWASP": ("owasp",),
    "JWT": ("jwt",),
    "RBAC": ("rbac", "role based access control"),
    "Secure Coding": ("secure coding", "application security"),
    "React Native": ("react native",),
    "Flutter": ("flutter",),
    "Swift": ("swift",),
    "Kotlin": ("kotlin",),
}


def get_audit_logs(session) -> list[dict[str, Any]]:
    return get_state(session, "auditLogs", [])


def append_audit_log(
    session,
    *,
    actor_id: str | None,
    actor_role: str,
    actor_name: str,
    action: str,
    target: str,
    meta: dict[str, Any] | None = None,
) -> None:
    logs = get_audit_logs(session)
    entry = {
        "id": f"log-{uuid4().hex[:12]}",
        "timestamp": datetime.now(UTC).isoformat(),
        "actorId": actor_id,
        "actorRole": actor_role,
        "actorName": actor_name,
        "action": action,
        "target": target,
        "meta": meta or {},
    }
    logs = [entry, *logs][:2000]
    set_state(session, "auditLogs", logs)


@lru_cache(maxsize=1)
def get_openai_client():
    if not OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI  # type: ignore
    except Exception:
        return None


def generate_gemini_text(
    *,
    system_instruction: str,
    user_prompt: str,
    temperature: float = 0.35,
    max_output_tokens: int = 240,
) -> str | None:
    if not GEMINI_API_KEY:
        return None

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(GEMINI_MODEL)}:generateContent"
        f"?key={urllib.parse.quote(GEMINI_API_KEY)}"
    )
    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
            "topP": 0.9,
        },
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:  # nosec B310
            parsed = json.loads(response.read().decode("utf-8"))
            candidates = parsed.get("candidates") or []
            if not candidates:
                return None
            parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
            text = " ".join(str(part.get("text") or "").strip() for part in parts if isinstance(part, dict)).strip()
            return text or None
    except Exception:
        return None


def generate_gemini_content(
    *,
    system_instruction: str,
    user_parts: list[dict[str, Any]],
    temperature: float = 0.35,
    max_output_tokens: int = 240,
) -> str | None:
    if not GEMINI_API_KEY or not user_parts:
        return None

    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(GEMINI_MODEL)}:generateContent"
        f"?key={urllib.parse.quote(GEMINI_API_KEY)}"
    )
    payload = {
        "system_instruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"role": "user", "parts": user_parts}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
            "topP": 0.9,
        },
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:  # nosec B310
            parsed = json.loads(response.read().decode("utf-8"))
            candidates = parsed.get("candidates") or []
            if not candidates:
                return None
            parts = (((candidates[0] or {}).get("content") or {}).get("parts") or [])
            text = " ".join(str(part.get("text") or "").strip() for part in parts if isinstance(part, dict)).strip()
            return text or None
    except Exception:
        return None


def extract_json_object(text: str) -> dict[str, Any] | None:
    raw = str(text or "").strip()
    if not raw:
        return None

    if raw.startswith("```"):
        raw = raw.replace("```json", "").replace("```", "").strip()

    if "{" in raw and "}" in raw:
        raw = raw[raw.find("{") : raw.rfind("}") + 1]

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def tokenize_resume_text(text: str) -> list[str]:
    import re

    return re.findall(r"[a-zA-Z][a-zA-Z0-9+\-#/.]{1,}", text.lower())


def local_resume_analysis(resume_payload: dict[str, Any]) -> dict[str, Any]:
    text = extract_resume_text(resume_payload, max_pages=6)
    if not text:
        return {
            "summary": "We could not extract enough readable information from this resume. Please try again or upload a clearer PDF copy.",
            "skills": [],
            "experience": [],
            "education": [],
            "status": "unreadable",
        }
    tokens = tokenize_resume_text(text)
    token_set = set(tokens)
    skill_hits: set[str] = set()
    for keyword_group in DOMAIN_KEYWORDS.values():
        for keyword in keyword_group:
            for token in tokenize_resume_text(keyword):
                if token in token_set:
                    skill_hits.add(token)
    summary = text[:500]
    return {
        "summary": summary,
        "skills": sorted(skill_hits)[:30],
        "experience": [],
        "education": [],
        "status": "ready",
    }


def format_skill_label(raw_skill: str) -> str:
    normalized = str(raw_skill or "").strip()
    if not normalized:
        return ""

    skill_aliases = {
        "javascript": "JavaScript",
        "typescript": "TypeScript",
        "nodejs": "Node.js",
        "node.js": "Node.js",
        "react": "React",
        "nextjs": "Next.js",
        "next.js": "Next.js",
        "html": "HTML",
        "css": "CSS",
        "sql": "SQL",
        "mysql": "MySQL",
        "postgresql": "PostgreSQL",
        "aws": "AWS",
        "api": "API",
        "rest": "REST",
        "graphql": "GraphQL",
        "fastapi": "FastAPI",
        "ci/cd": "CI/CD",
        "docker": "Docker",
        "kubernetes": "Kubernetes",
        "python": "Python",
        "java": "Java",
        "c++": "C++",
        "c#": "C#",
    }
    lowered = normalized.lower()
    if lowered in skill_aliases:
        return skill_aliases[lowered]
    if normalized.isupper() and len(normalized) <= 6:
        return normalized
    return " ".join(part[:1].upper() + part[1:] for part in normalized.split())


def is_suspicious_resume_value(value: str) -> bool:
    lowered = str(value or "").strip().lower()
    if not lowered:
        return True
    suspicious_markers = ("email:", "phone:", "skills:", "education:", "experience:", "@")
    return any(marker in lowered for marker in suspicious_markers)


def clean_resume_field(value: Any) -> str:
    cleaned = str(value or "").strip()
    return "" if is_suspicious_resume_value(cleaned) else cleaned


def normalize_skill_list(items: list[Any], limit: int = 30) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    role_words = {"developer", "engineer", "manager", "analyst", "intern", "specialist", "consultant", "architect"}

    for item in items:
        value = str(item or "").strip()
        if not value:
            continue
        if ":" in value or "@" in value:
            continue
        tokens = tokenize_resume_text(value)
        if not tokens or len(tokens) > 3:
            continue
        if len(tokens) >= 2 and any(token in role_words for token in tokens):
            continue
        skill = format_skill_label(value)
        if not skill:
            continue
        dedupe_key = skill.lower()
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        cleaned.append(skill)
        if len(cleaned) >= limit:
            break

    return cleaned


def cvparse_base_url() -> str:
    custom_url = str(RESUME_PARSER_API_URL or "").strip().rstrip("/")
    return custom_url or "https://api.cvparse.io"


def encode_multipart_form(file_name: str, file_bytes: bytes, media_type: str) -> tuple[bytes, str]:
    boundary = f"----SkillSenseBoundary{uuid4().hex}"
    parts = [
        f"--{boundary}\r\n".encode("utf-8"),
        f'Content-Disposition: form-data; name="file"; filename="{file_name}"\r\n'.encode("utf-8"),
        f"Content-Type: {media_type or 'application/octet-stream'}\r\n\r\n".encode("utf-8"),
        file_bytes,
        f"\r\n--{boundary}--\r\n".encode("utf-8"),
    ]
    return b"".join(parts), boundary


def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    data: bytes | None = None,
    timeout: int = 25,
) -> dict[str, Any] | None:
    request = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # nosec B310
            payload = json.loads(response.read().decode("utf-8"))
            return payload if isinstance(payload, dict) else None
    except Exception:
        return None


def format_resume_duration(start_date: str | None, end_date: str | None, is_current: bool = False) -> str:
    start = str(start_date or "").strip()
    end = str(end_date or "").strip()
    if start and end:
        return f"{start} - {end}"
    if start and is_current:
        return f"{start} - Present"
    if end:
        return end
    return start


def summarize_cvparse_result(parsed: dict[str, Any], fallback_summary: str) -> str:
    summary = str(parsed.get("summary") or "").strip()
    if summary:
        return summary[:500]

    full_name = str(parsed.get("full_name") or "").strip()
    work_experience = parsed.get("work_experience", []) if isinstance(parsed.get("work_experience"), list) else []
    first_role = work_experience[0] if work_experience and isinstance(work_experience[0], dict) else {}
    title = clean_resume_field(first_role.get("title"))
    company = clean_resume_field(first_role.get("company"))
    skills = normalize_skill_list(parsed.get("skills", []) if isinstance(parsed.get("skills"), list) else [], limit=6)
    if full_name:
        skills = [skill for skill in skills if skill.lower() != full_name.lower()]

    snippets: list[str] = []
    if full_name:
        snippets.append(f"{full_name}'s resume was parsed successfully.")
    if title:
        company_text = f" at {company}" if company else ""
        snippets.append(f"Recent experience includes {title}{company_text}.")
    if skills:
        snippets.append(f"Key skills include {', '.join(skills[:6])}.")

    combined = " ".join(snippets).strip()
    return (combined or fallback_summary or "Resume parsed successfully.")[:500]


def map_cvparse_result(
    job_result: dict[str, Any],
    fallback_analysis: dict[str, Any],
    fallback_summary: str,
) -> dict[str, Any]:
    parsed = job_result.get("data", {}) if isinstance(job_result.get("data"), dict) else {}
    metadata = job_result.get("metadata", {}) if isinstance(job_result.get("metadata"), dict) else {}

    skills = normalize_skill_list(parsed.get("skills", []) if isinstance(parsed.get("skills"), list) else [])
    if fallback_analysis.get("skills"):
        skills = normalize_skill_list([*skills, *(fallback_analysis.get("skills") or [])], limit=40)

    work_experience = parsed.get("work_experience", []) if isinstance(parsed.get("work_experience"), list) else []
    experience: list[dict[str, str]] = []
    for item in work_experience[:6]:
        if not isinstance(item, dict):
            continue
        title = clean_resume_field(item.get("title"))
        company = clean_resume_field(item.get("company"))
        duration = format_resume_duration(
            item.get("start_date"),
            item.get("end_date"),
            bool(item.get("is_current")),
        )
        responsibilities = item.get("responsibilities", []) if isinstance(item.get("responsibilities"), list) else []
        highlights = [clean_resume_field(entry) for entry in responsibilities]
        highlights = [entry for entry in highlights if entry][:3]
        if not any([title, company, highlights]):
            continue
        experience.append(
            {
                "title": title,
                "company": company,
                "duration": duration,
                "highlights": ", ".join(highlights),
            }
        )

    education_entries = parsed.get("education", []) if isinstance(parsed.get("education"), list) else []
    education: list[dict[str, str]] = []
    for item in education_entries[:5]:
        if not isinstance(item, dict):
            continue
        degree = str(item.get("degree") or "").strip()
        institution = clean_resume_field(item.get("institution"))
        end_year = str(item.get("end_date") or item.get("year") or "").strip()
        field = str(item.get("field") or "").strip()
        if degree and len(degree) < 3 and degree != degree.upper():
            degree = ""
        if not any([degree, institution, field]):
            continue
        education.append(
            {
                "degree": degree,
                "institution": institution,
                "year": end_year,
                "field": field,
            }
        )

    confidence_score = metadata.get("confidence_score")
    warnings = metadata.get("extraction_warnings", [])
    if not isinstance(warnings, list):
        warnings = []
    candidate_name = clean_resume_field(parsed.get("full_name"))
    candidate_email = str(parsed.get("email") or "").strip()

    analysis = {
        "summary": summarize_cvparse_result(parsed, fallback_summary),
        "skills": [skill for skill in skills if not candidate_name or skill.lower() != candidate_name.lower()],
        "experience": experience,
        "education": education,
        "status": "ready",
        "provider": "cvparse",
        "confidenceScore": confidence_score,
        "qualityGrade": str(parsed.get("quality_grade") or "").strip(),
        "warnings": [str(item).strip() for item in warnings if str(item).strip()][:6],
        "candidateName": candidate_name,
        "candidateEmail": candidate_email,
    }

    if not analysis["summary"] and fallback_analysis.get("summary"):
        analysis["summary"] = str(fallback_analysis.get("summary") or "")
    if not analysis["skills"] and fallback_analysis.get("skills"):
        analysis["skills"] = normalize_skill_list(fallback_analysis.get("skills") or [], limit=40)
    if not analysis["experience"] and fallback_analysis.get("experience"):
        analysis["experience"] = fallback_analysis.get("experience") or []
    if not analysis["education"] and fallback_analysis.get("education"):
        analysis["education"] = fallback_analysis.get("education") or []

    return analysis


def cvparse_resume_analysis(resume_payload: dict[str, Any], fallback_analysis: dict[str, Any]) -> dict[str, Any] | None:
    if not RESUME_PARSER_API_KEY:
        return None

    try:
        file_bytes, media_type, file_name = decode_resume_payload(resume_payload)
    except HTTPException:
        return None

    if not file_bytes:
        return None

    form_body, boundary = encode_multipart_form(file_name, file_bytes, media_type or "application/pdf")
    headers = {
        "x-api-key": RESUME_PARSER_API_KEY,
        "Accept": "application/json",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    base_url = cvparse_base_url()
    parse_response = request_json(
        f"{base_url}/api/v1/parse?translate=true",
        method="POST",
        headers=headers,
        data=form_body,
        timeout=40,
    )
    if not parse_response:
        return None

    job_id = str(parse_response.get("job_id") or "").strip()
    if not job_id:
        return None

    status: dict[str, Any] | None = None
    poll_deadline = time.time() + 25
    while time.time() < poll_deadline:
        time.sleep(1.0)
        status = request_json(
            f"{base_url}/api/v1/jobs/{urllib.parse.quote(job_id)}",
            headers={"x-api-key": RESUME_PARSER_API_KEY, "Accept": "application/json"},
            timeout=20,
        )
        if not status:
            continue
        state = str(status.get("status") or "").strip().lower()
        if state in {"completed", "failed"}:
            break

    if not status:
        return None

    status_value = str(status.get("status") or "").strip().lower()
    result = request_json(
        f"{base_url}/api/v1/jobs/{urllib.parse.quote(job_id)}/result",
        headers={"x-api-key": RESUME_PARSER_API_KEY, "Accept": "application/json"},
        timeout=25,
    )
    if status_value != "completed" and not result:
        return None
    if not result:
        return None

    fallback_summary = extract_resume_text_excerpt(resume_payload, 600) or str(fallback_analysis.get("summary") or "")
    return map_cvparse_result(result, fallback_analysis, fallback_summary)


def ai_resume_enrichment(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    prompt = (
        "Extract a concise JSON object with keys: summary, skills, experience, education. "
        "summary: 1-2 sentences. skills: array of top skills. "
        "experience: array of {title, company, duration}. education: array of {degree, institution, year}. "
        "Use only information present in the resume text.\n\n"
        f"RESUME TEXT:\n{text[:4000]}"
    )
    response = generate_gemini_text(
        system_instruction="You are a resume analyst that outputs strict JSON.",
        user_prompt=prompt,
        temperature=0.2,
        max_output_tokens=300,
    )
    if not response:
        return None
    parsed = extract_json_object(response)
    if not parsed:
        return None
    return parsed


def ai_resume_pdf_fallback(resume_payload: dict[str, Any]) -> dict[str, Any] | None:
    try:
        file_bytes, media_type, file_name = decode_resume_payload(resume_payload)
    except HTTPException:
        return None

    if not file_bytes or (media_type and "pdf" not in media_type.lower()):
        return None

    prompt = (
        "Read this resume PDF, including scanned pages if necessary, and extract a strict JSON object with keys: "
        "summary, skills, experience, education, status. "
        "summary must be 1-2 sentences grounded only in the document. "
        "skills must be an array of concise skill names. "
        "experience must be an array of objects with keys title, company, duration. "
        "education must be an array of objects with keys degree, institution, year. "
        "Set status to ready when any usable resume information is found, otherwise unreadable. "
        "Do not wrap the JSON in markdown."
    )
    response = generate_gemini_content(
        system_instruction="You are an OCR-capable resume parser that extracts facts from PDFs and returns strict JSON.",
        user_parts=[
            {"text": prompt},
            {
                "inlineData": {
                    "mimeType": media_type or "application/pdf",
                    "data": base64.b64encode(file_bytes).decode("utf-8"),
                }
            },
            {"text": f"Filename: {file_name}"},
        ],
        temperature=0.1,
        max_output_tokens=700,
    )
    if not response:
        return None

    parsed = extract_json_object(response)
    if not parsed:
        return None

    result = {
        "summary": str(parsed.get("summary") or "").strip(),
        "skills": normalize_skill_list(parsed.get("skills") if isinstance(parsed.get("skills"), list) else [], limit=40),
        "experience": parsed.get("experience") if isinstance(parsed.get("experience"), list) else [],
        "education": parsed.get("education") if isinstance(parsed.get("education"), list) else [],
        "status": str(parsed.get("status") or "").strip().lower() or "ready",
        "provider": "gemini-pdf",
    }

    usable = bool(
        result["summary"]
        or result["skills"]
        or result["experience"]
        or result["education"]
    )
    if usable:
        result["status"] = "ready"
        if not result["summary"]:
            result["summary"] = "Resume parsed successfully from the uploaded PDF."
        return result

    return None


def analyze_resume_payload(resume_payload: dict[str, Any]) -> dict[str, Any]:
    analysis = local_resume_analysis(resume_payload)
    provider = str(RESUME_PARSER_PROVIDER or "local").strip().lower()
    if provider == "cvparse" and RESUME_PARSER_API_KEY:
        external_analysis = cvparse_resume_analysis(resume_payload, analysis)
        if external_analysis:
            analysis = external_analysis
    needs_pdf_fallback = (
        analysis.get("status") == "unreadable"
        or not (
            analysis.get("skills")
            or analysis.get("experience")
            or analysis.get("education")
        )
    )
    if needs_pdf_fallback:
        pdf_fallback = ai_resume_pdf_fallback(resume_payload)
        if pdf_fallback:
            merged = {**analysis, **pdf_fallback}
            if isinstance(merged.get("skills"), list):
                merged["skills"] = normalize_skill_list(merged["skills"], limit=40)
            merged["status"] = "ready"
            return merged
    should_enrich = not (
        analysis.get("provider") == "cvparse"
        and analysis.get("status") == "ready"
        and (
            analysis.get("skills")
            or analysis.get("experience")
            or analysis.get("education")
        )
    )
    enriched = None
    if should_enrich:
        enriched = ai_resume_enrichment(analysis.get("summary") or extract_resume_text_excerpt(resume_payload, 3500))
    if enriched and isinstance(enriched, dict):
        merged = {**analysis, **enriched}
        if isinstance(merged.get("skills"), list):
            merged["skills"] = normalize_skill_list(merged["skills"], limit=40)
        merged["status"] = merged.get("status") or "ready"
        return merged
    if isinstance(analysis.get("skills"), list):
        analysis["skills"] = normalize_skill_list(analysis["skills"], limit=40)
    return analysis


def contains_phrase(text: str, phrase: str) -> bool:
    import re

    haystack = str(text or "").strip().lower()
    needle = str(phrase or "").strip().lower()
    if not haystack or not needle:
        return False
    pattern = r"\b" + re.escape(needle).replace(r"\ ", r"\s+") + r"\b"
    return re.search(pattern, haystack) is not None


def extract_skill_mentions(text: str) -> list[str]:
    normalized = " ".join(str(text or "").split()).lower()
    if not normalized:
        return []

    found: list[str] = []
    for skill, patterns in JOB_MATCH_SKILL_LIBRARY.items():
        if any(contains_phrase(normalized, pattern) for pattern in patterns):
            found.append(skill)

    for keyword_group in DOMAIN_KEYWORDS.values():
        for keyword in keyword_group:
            if contains_phrase(normalized, keyword):
                label = format_skill_label(keyword)
                if label and label not in found:
                    found.append(label)

    return found[:40]


def build_resume_match_corpus(journey: dict[str, Any], resume_analysis: dict[str, Any]) -> str:
    profile = journey.get("profile", {}) if isinstance(journey.get("profile"), dict) else {}
    resume = journey.get("resume", {}) if isinstance(journey.get("resume"), dict) else {}

    parts: list[str] = [
        str(profile.get("role") or ""),
        str(profile.get("summary") or ""),
        " ".join(journey.get("skills", []) if isinstance(journey.get("skills"), list) else []),
        str(resume_analysis.get("summary") or ""),
        " ".join(resume_analysis.get("skills", []) if isinstance(resume_analysis.get("skills"), list) else []),
        extract_resume_text_excerpt(resume, 4500),
    ]

    for item in resume_analysis.get("experience", []) if isinstance(resume_analysis.get("experience"), list) else []:
        if not isinstance(item, dict):
            continue
        parts.extend(
            [
                str(item.get("title") or ""),
                str(item.get("company") or ""),
                str(item.get("duration") or ""),
                str(item.get("highlights") or ""),
            ]
        )

    for item in resume_analysis.get("education", []) if isinstance(resume_analysis.get("education"), list) else []:
        if not isinstance(item, dict):
            continue
        parts.extend(
            [
                str(item.get("degree") or ""),
                str(item.get("institution") or ""),
                str(item.get("field") or ""),
            ]
        )

    return " ".join(part for part in parts if part).strip()


def rank_domain_alignment(text: str) -> list[dict[str, Any]]:
    corpus = str(text or "").strip().lower()
    rankings: list[dict[str, Any]] = []
    for domain_id, keywords in DOMAIN_KEYWORDS.items():
        hits = sum(1 for keyword in keywords if contains_phrase(corpus, keyword))
        if not hits:
            continue
        rankings.append(
            {
                "id": domain_id,
                "title": domain_id.replace("-", " ").title(),
                "hits": hits,
                "keywords": [keyword for keyword in keywords if contains_phrase(corpus, keyword)][:4],
            }
        )

    rankings.sort(key=lambda item: item["hits"], reverse=True)
    return rankings


def fit_label_for_score(score: int) -> str:
    if score >= 82:
        return "Strong Match"
    if score >= 65:
        return "Promising Match"
    if score >= 48:
        return "Partial Match"
    return "Stretch Match"


def analyze_job_match(
    *,
    journey: dict[str, Any],
    job_description: str,
    resume_analysis: dict[str, Any],
) -> dict[str, Any]:
    profile = journey.get("profile", {}) if isinstance(journey.get("profile"), dict) else {}
    jd_text = " ".join(str(job_description or "").split()).strip()
    resume_corpus = build_resume_match_corpus(journey, resume_analysis)

    jd_skills = extract_skill_mentions(jd_text)
    resume_skills = extract_skill_mentions(resume_corpus)
    resume_skill_set = {skill.lower(): skill for skill in resume_skills}

    matched_skills = [skill for skill in jd_skills if skill.lower() in resume_skill_set]
    missing_skills = [skill for skill in jd_skills if skill.lower() not in resume_skill_set]

    jd_domain_hits = rank_domain_alignment(jd_text)
    resume_domain_hits = rank_domain_alignment(resume_corpus)
    resume_domain_map = {item["id"]: item for item in resume_domain_hits}

    domain_alignment: list[dict[str, Any]] = []
    for item in jd_domain_hits[:4]:
        jd_hits = max(item["hits"], 1)
        resume_hits = resume_domain_map.get(item["id"], {}).get("hits", 0)
        score = min(100, int(round((resume_hits / jd_hits) * 100)))
        evidence = resume_domain_map.get(item["id"], {}).get("keywords", [])
        domain_alignment.append(
            {
                "domain": item["title"],
                "score": score,
                "evidence": evidence,
            }
        )

    years_experience_raw = str(profile.get("yearsExperience") or "").strip()
    years_experience = float(years_experience_raw) if years_experience_raw.replace(".", "", 1).isdigit() else 0.0
    skill_ratio = len(matched_skills) / max(len(jd_skills), 1) if jd_skills else 0.45
    domain_score = (sum(item["score"] for item in domain_alignment) / max(len(domain_alignment), 1)) / 100 if domain_alignment else 0.35
    experience_bonus = min(years_experience / 8, 1.0) * 8
    score = int(round(max(24, min(96, 28 + (skill_ratio * 48) + (domain_score * 16) + experience_bonus))))

    top_strengths: list[str] = []
    if matched_skills:
        top_strengths.append(f"Resume already reflects core requirements such as {', '.join(matched_skills[:4])}.")
    if domain_alignment:
        best_domain = max(domain_alignment, key=lambda item: item["score"])
        top_strengths.append(f"Best alignment is in {best_domain['domain']} with a {best_domain['score']}% overlap against the job brief.")
    if years_experience:
        top_strengths.append(f"Profile shows {years_experience:g}+ years of experience, which strengthens seniority alignment.")

    risk_factors: list[str] = []
    if missing_skills:
        risk_factors.append(f"Missing or weak evidence for {', '.join(missing_skills[:5])}.")
    if not resume_analysis.get("experience"):
        risk_factors.append("Work experience evidence is still thin, so interview validation matters more.")
    if years_experience < 2:
        risk_factors.append("Limited stated experience may reduce fit for mid-to-senior roles.")

    interview_focus = []
    if missing_skills:
        interview_focus.append(f"Probe practical depth in {missing_skills[0]} and ask for a real production example.")
    if matched_skills:
        interview_focus.append(f"Validate measurable impact from {matched_skills[0]} work, not just tool familiarity.")
    interview_focus.append("Ask for one end-to-end project story covering architecture, tradeoffs, and delivery impact.")
    if domain_alignment:
        weakest_domain = min(domain_alignment, key=lambda item: item["score"])
        interview_focus.append(f"Test weaker alignment in {weakest_domain['domain']} before moving to final round.")

    recommended_actions = []
    if missing_skills:
        recommended_actions.append(f"Tailor the resume to show evidence for {', '.join(missing_skills[:3])}.")
    recommended_actions.append("Add quantified project outcomes so recruiters can connect experience to business impact.")
    recommended_actions.append("Use the interview to turn broad claims into specific architecture and debugging examples.")

    fit_label = fit_label_for_score(score)
    summary_parts = [f"This resume is a {fit_label.lower()} for the current job description with a {score}% match score."]
    if matched_skills:
        summary_parts.append(f"Strongest overlap appears in {', '.join(matched_skills[:3])}.")
    if missing_skills:
        summary_parts.append(f"Biggest gaps are {', '.join(missing_skills[:3])}.")

    return {
        "score": score,
        "fitLabel": fit_label,
        "summary": " ".join(summary_parts),
        "matchedSkills": matched_skills[:10],
        "missingSkills": missing_skills[:10],
        "highlightedStrengths": top_strengths[:3],
        "riskFactors": risk_factors[:3],
        "interviewFocus": interview_focus[:4],
        "recommendedActions": recommended_actions[:3],
        "domainAlignment": domain_alignment[:4],
        "jobSkillCount": len(jd_skills),
        "matchedSkillCount": len(matched_skills),
    }


def build_interview_context(journey: dict[str, Any]) -> dict[str, Any]:
    profile = journey.get("profile", {}) if isinstance(journey.get("profile"), dict) else {}
    resume = journey.get("resume", {}) if isinstance(journey.get("resume"), dict) else {}
    resume_analysis = journey.get("resumeAnalysis", {}) if isinstance(journey.get("resumeAnalysis"), dict) else {}
    resume_excerpt = extract_resume_text_excerpt(resume)
    resume_skills = resume_analysis.get("skills", []) if isinstance(resume_analysis.get("skills"), list) else []
    return {
        "domains": journey.get("domains", []),
        "skills": journey.get("skills", []),
        "profileSummary": str(profile.get("summary") or "").strip(),
        "experienceLevel": str(profile.get("experienceLevel") or "").strip(),
        "yearsExperience": str(profile.get("yearsExperience") or "").strip(),
        "role": str(profile.get("role") or "").strip(),
        "resumeFileName": str(resume.get("fileName") or "").strip(),
        "resumeExcerpt": resume_excerpt,
        "resumeAnalysis": resume_analysis,
        "resumeSkills": resume_skills,
    }


def merge_resume_skills(journey: dict[str, Any]) -> list[str]:
    base_skills = journey.get("skills", []) if isinstance(journey.get("skills"), list) else []
    resume_analysis = journey.get("resumeAnalysis", {}) if isinstance(journey.get("resumeAnalysis"), dict) else {}
    resume_skills = resume_analysis.get("skills", []) if isinstance(resume_analysis.get("skills"), list) else []
    combined = [str(skill).strip() for skill in [*base_skills, *resume_skills] if str(skill).strip()]
    # preserve order + dedupe
    return list(dict.fromkeys(combined))[:15]


def build_resume_focus_question(journey: dict[str, Any]) -> dict[str, str] | None:
    resume_analysis = journey.get("resumeAnalysis", {}) if isinstance(journey.get("resumeAnalysis"), dict) else {}
    experience = resume_analysis.get("experience", []) if isinstance(resume_analysis.get("experience"), list) else []
    if experience:
        first = experience[0] if isinstance(experience[0], dict) else {}
        title = str(first.get("title") or "").strip()
        company = str(first.get("company") or "").strip()
        if title:
            company_text = f" at {company}" if company else ""
            return {
                "id": "resume-focus",
                "domainId": "general",
                "question": f"Tell me about your most recent role as {title}{company_text}. What were your biggest responsibilities and wins?",
                "hint": "Mention scope, technical stack, and measurable impact.",
            }
    return None
    try:
        return OpenAI(api_key=OPENAI_API_KEY)
    except Exception:
        return None


def derive_name_from_email(email: str) -> str:
    local = email.split("@", 1)[0].strip()
    if not local:
        return "Employee"
    tokens = [token for token in local.replace(".", " ").replace("_", " ").replace("-", " ").split() if token]
    if not tokens:
        return "Employee"
    return " ".join(token[:1].upper() + token[1:] for token in tokens)


def serialize_user(user: UserRecord) -> dict[str, Any]:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "fullName": user.full_name,
        "department": user.department,
    }


def build_session(user: UserRecord) -> dict[str, Any]:
    encoded_user = base64.urlsafe_b64encode(user.id.encode("utf-8")).decode("utf-8").rstrip("=")
    token = f"token.{encoded_user}.{secrets.token_urlsafe(24)}"
    ACTIVE_SESSIONS[token] = {
        "userId": user.id,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "device": "Web browser",
    }
    return {"token": token, "user": serialize_user(user)}


def issue_session_response(user: UserRecord, response: Response) -> dict[str, Any]:
    session = build_session(user)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session["token"],
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=SESSION_COOKIE_MAX_AGE,
        path="/",
    )
    return {"user": session["user"]}


def cleanup_two_factor_challenges() -> None:
    now = time.time()
    expired = [challenge_id for challenge_id, challenge in TWO_FACTOR_CHALLENGES.items() if challenge["expiresAtTs"] <= now]
    for challenge_id in expired:
        TWO_FACTOR_CHALLENGES.pop(challenge_id, None)


def cleanup_active_sessions() -> None:
    stale_tokens = [token for token, details in ACTIVE_SESSIONS.items() if not details.get("userId")]
    for token in stale_tokens:
        ACTIVE_SESSIONS.pop(token, None)


def require_human_verification(payload: dict[str, Any]) -> None:
    token = str(payload.get("recaptchaToken") or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Please complete the captcha verification before continuing")
    ok, reason = verify_recaptcha_token(token)
    if not ok:
        detail = "Captcha verification failed"
        if reason:
            detail = f"{detail}: {reason}"
        raise HTTPException(status_code=400, detail=detail)


def verify_recaptcha_token(token: str) -> tuple[bool, str | None]:
    if not RECAPTCHA_SECRET_KEY:
        return False, "server_misconfigured"
    payload = urllib.parse.urlencode({"secret": RECAPTCHA_SECRET_KEY, "response": token}).encode("utf-8")
    request = urllib.request.Request(
        "https://www.google.com/recaptcha/api/siteverify",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:  # nosec B310
            data = json.loads(response.read().decode("utf-8"))
            if data.get("success"):
                return True, None
            error_codes = data.get("error-codes") or data.get("error_codes") or []
            if isinstance(error_codes, list) and error_codes:
                return False, ",".join(str(code) for code in error_codes)
            return False, "unknown_error"
    except Exception:
        return False, "verification_error"


def issue_two_factor_challenge(user: UserRecord) -> dict[str, Any]:
    cleanup_two_factor_challenges()
    challenge_id = secrets.token_urlsafe(18)
    verification_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at_ts = time.time() + TWO_FACTOR_TTL_SECONDS
    TWO_FACTOR_CHALLENGES[challenge_id] = {
        "userId": user.id,
        "code": verification_code,
        "expiresAtTs": expires_at_ts,
    }
    return {
        "requiresTwoFactor": True,
        "challengeId": challenge_id,
        "expiresAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(expires_at_ts)),
        "verificationCodePreview": verification_code,
        "user": serialize_user(user),
    }


def get_current_token(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        cookie_token = REQUEST_SESSION_TOKEN.get()
        return cookie_token
    return authorization.replace("Bearer ", "", 1)


def decode_user_id_from_token(token: str) -> str | None:
    # New format: token.<base64_user_id>.<random>
    if token.startswith("token."):
        parts = token.split(".")
        if len(parts) >= 3:
            encoded_user = parts[1]
            padding = "=" * ((4 - len(encoded_user) % 4) % 4)
            try:
                return base64.urlsafe_b64decode((encoded_user + padding).encode("utf-8")).decode("utf-8")
            except (ValueError, binascii.Error, UnicodeDecodeError):
                return None

    # Legacy format support: token-<user_id>
    if token.startswith("token-"):
        return token.replace("token-", "", 1)

    return None


def cache_get(key: str, ttl_seconds: float) -> Any | None:
    entry = FAST_CACHE.get(key)
    if not entry:
        return None
    timestamp, payload = entry
    if (time.time() - timestamp) > ttl_seconds:
        FAST_CACHE.pop(key, None)
        return None
    return deepcopy(payload)


def cache_set(key: str, payload: Any) -> None:
    FAST_CACHE[key] = (time.time(), deepcopy(payload))


def cache_invalidate(*keys: str) -> None:
    for key in keys:
        if key.endswith("*"):
            prefix = key[:-1]
            for cache_key in list(FAST_CACHE.keys()):
                if cache_key.startswith(prefix):
                    FAST_CACHE.pop(cache_key, None)
            continue
        FAST_CACHE.pop(key, None)


def smtp_ready() -> bool:
    return bool(SMTP_HOST and SMTP_PORT and SMTP_USER and SMTP_PASSWORD)


def build_from_address() -> str:
    from_email = SMTP_FROM_EMAIL or SMTP_USER
    display_name = SMTP_FROM_NAME or "SkillSenseAI"
    return formataddr((display_name, from_email))


def normalize_email_targets(targets: list[str] | str) -> list[str]:
    if isinstance(targets, str):
        targets = [targets]
    normalized = []
    for item in targets:
        email = str(item or "").strip()
        if email and "@" in email:
            normalized.append(email)
    # preserve order while deduping
    return list(dict.fromkeys(normalized))


def send_email_async(subject: str, body: str, targets: list[str] | str) -> None:
    if not smtp_ready():
        return
    recipients = normalize_email_targets(targets)
    if not recipients:
        return

    message = EmailMessage()
    message["From"] = build_from_address()
    message["To"] = ", ".join(recipients)
    message["Subject"] = subject
    message.set_content(body)

    def _send() -> None:
        try:
            context = ssl.create_default_context()
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=12) as server:
                server.ehlo()
                if SMTP_PORT == 587:
                    server.starttls(context=context)
                    server.ehlo()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(message)
        except Exception:
            # Intentionally swallow errors to keep API response fast.
            return

    threading.Thread(target=_send, daemon=True).start()


def get_security_settings(session) -> dict[str, Any]:
    row = session.get(SettingsRecord, "security")
    stored = loads_json(row.payload, {}) if row else {}
    return {**DEFAULT_SETTINGS["security"], **stored}


def user_settings_state_key(user_id: str) -> str:
    return f"settings:{user_id}"


def build_settings_payload_for_user(user: UserRecord, stored: dict[str, Any] | None = None) -> dict[str, Any]:
    if not isinstance(stored, dict):
        stored = {}

    profile_defaults = {
        **DEFAULT_SETTINGS["profile"],
        "name": user.full_name or DEFAULT_SETTINGS["profile"].get("name", ""),
        "email": user.email or DEFAULT_SETTINGS["profile"].get("email", ""),
        "department": user.department or DEFAULT_SETTINGS["profile"].get("department", ""),
    }

    return {
        "profile": {**profile_defaults, **(stored.get("profile", {}) if isinstance(stored.get("profile"), dict) else {})},
        "preferences": {**DEFAULT_SETTINGS["preferences"], **(stored.get("preferences", {}) if isinstance(stored.get("preferences"), dict) else {})},
        "localization": {**DEFAULT_SETTINGS["localization"], **(stored.get("localization", {}) if isinstance(stored.get("localization"), dict) else {})},
        "privacy": {**DEFAULT_SETTINGS["privacy"], **(stored.get("privacy", {}) if isinstance(stored.get("privacy"), dict) else {})},
        "security": {**DEFAULT_SETTINGS["security"], **(stored.get("security", {}) if isinstance(stored.get("security"), dict) else {})},
        "appearance": {**DEFAULT_SETTINGS["appearance"], **(stored.get("appearance", {}) if isinstance(stored.get("appearance"), dict) else {})},
        "updatedAt": stored.get("updatedAt", ""),
    }


def get_settings_for_user(session, user: UserRecord) -> dict[str, Any]:
    stored = get_state(session, user_settings_state_key(user.id), {})
    return build_settings_payload_for_user(user, stored if isinstance(stored, dict) else {})


def normalize_settings_section_payload(section: str, payload: dict[str, Any]) -> dict[str, Any]:
    allowed_fields = SETTINGS_FIELD_ALLOWLIST.get(section, set())
    if not isinstance(payload, dict):
        return {}
    return {key: payload[key] for key in allowed_fields if key in payload}


def update_settings_for_user(session, user: UserRecord, section: str, payload: dict[str, Any]) -> dict[str, Any]:
    if section not in SETTINGS_SECTIONS:
        raise HTTPException(status_code=404, detail="Unknown settings section")

    current = get_settings_for_user(session, user)
    normalized = normalize_settings_section_payload(section, payload)
    current[section] = {**current.get(section, {}), **normalized}
    current["updatedAt"] = datetime.now(UTC).isoformat()

    # Keep profile defaults aligned with auth identity when fields are blank.
    if section == "profile":
        profile = current.get("profile", {})
        if not str(profile.get("name") or "").strip():
            profile["name"] = user.full_name
        if not str(profile.get("email") or "").strip():
            profile["email"] = user.email
        if not str(profile.get("department") or "").strip():
            profile["department"] = user.department

    set_state(session, user_settings_state_key(user.id), current)
    return current


def get_user_email_for_notifications(session, user: UserRecord) -> str:
    settings = get_settings_for_user(session, user)
    profile = settings.get("profile", {}) if isinstance(settings.get("profile"), dict) else {}
    return str(profile.get("email") or user.email or "").strip()


def wants_email_notifications(session, user: UserRecord, category: str) -> bool:
    settings = get_settings_for_user(session, user)
    prefs = settings.get("preferences", {}) if isinstance(settings.get("preferences"), dict) else {}
    if category == "assessment":
        return bool(prefs.get("assessmentNotifications", False))
    if category == "weekly":
        return bool(prefs.get("weeklyReport", False)) and bool(prefs.get("emailAlerts", False))
    return bool(prefs.get("emailAlerts", False))


def get_manager_recipients(session, category: str) -> list[str]:
    recipients: list[str] = []
    managers = session.scalars(select(UserRecord).where(UserRecord.role == "manager")).all()
    for manager in managers:
        if not wants_email_notifications(session, manager, category):
            continue
        email = get_user_email_for_notifications(session, manager)
        if email:
            recipients.append(email)
    return normalize_email_targets(recipients)


def format_score_value(score: Any) -> str:
    try:
        return f"{float(score):.1f}"
    except (TypeError, ValueError):
        return "N/A"


def sync_employee_record_status(
    session,
    user: UserRecord,
    status: str,
    *,
    last_assessment: str | None = None,
) -> None:
    employee = session.scalar(select(EmployeeRecord).where(EmployeeRecord.email == user.email))
    normalized_status = str(status or "pending").strip().lower()
    if employee:
        employee.status = normalized_status
        if last_assessment:
            employee.last_assessment = last_assessment
        if not str(employee.name or "").strip():
            employee.name = user.full_name or derive_name_from_email(user.email)
        if not str(employee.role or "").strip():
            employee.role = f"{user.department or 'General'} Specialist"
        return
    session.add(
        EmployeeRecord(
            name=user.full_name or derive_name_from_email(user.email),
            email=user.email,
            role=f"{user.department or 'General'} Specialist",
            skills_json=dumps_json([]),
            skill_level=0.0,
            status=normalized_status,
            last_assessment=last_assessment or "Never",
        )
    )


def wants_inapp_notifications(session, user: UserRecord, category: str) -> bool:
    settings = get_settings_for_user(session, user)
    prefs = settings.get("preferences", {}) if isinstance(settings.get("preferences"), dict) else {}
    if not prefs.get("pushNotifications", False):
        return False
    if category == "assessment":
        return bool(prefs.get("assessmentNotifications", False))
    if category == "weekly":
        return bool(prefs.get("weeklyReport", False))
    return True


def build_time_label(now: datetime) -> str:
    return now.strftime("%b %d, %H:%M UTC")


def create_inapp_notification(session, user: UserRecord, title: str, message: str, category: str = "general") -> None:
    if not wants_inapp_notifications(session, user, category):
        return
    now = datetime.now(UTC)
    session.add(
        NotificationRecord(
            title=title,
            message=message,
            time_label=build_time_label(now),
            is_read=False,
            user_id=user.id,
            created_at=now.isoformat(),
            category=category,
        )
    )
    cache_invalidate(f"notifications:list:{user.id}")


def ensure_weekly_report_notification(session, user: UserRecord) -> None:
    if not wants_inapp_notifications(session, user, "weekly"):
        return
    today = datetime.now(UTC)
    iso_year, iso_week, _ = today.isocalendar()
    week_key = f"{iso_year}-W{iso_week:02d}"
    state_key = f"weeklyReportNotice:{user.id}"
    last_week = get_state(session, state_key, "")
    if last_week == week_key:
        return
    create_inapp_notification(
        session,
        user,
        "Weekly report ready",
        "Your weekly performance report is available in the Reports dashboard.",
        "weekly",
    )
    set_state(session, state_key, week_key)


def ensure_weekly_report_email(session, user: UserRecord, reports_payload: dict[str, Any]) -> None:
    if not wants_email_notifications(session, user, "weekly"):
        return
    today = datetime.now(UTC)
    iso_year, iso_week, _ = today.isocalendar()
    week_key = f"{iso_year}-W{iso_week:02d}"
    state_key = f"weeklyReportEmail:{user.id}"
    last_week = get_state(session, state_key, "")
    if last_week == week_key:
        return
    trend = reports_payload.get("trendData", [])
    skill_report = reports_payload.get("skillReport", [])
    avg_score = "0.0"
    if skill_report:
        avg_score = f"{(sum(item.get('avgScore', 0) for item in skill_report) / len(skill_report)):.1f}"
    latest_trend = trend[-1]["avgScore"] if trend else 0
    body = "\n".join(
        [
            f"Hi {user.full_name},",
            "",
            "Your weekly team performance digest is ready.",
            f"Average team score: {avg_score}/5",
            f"Latest monthly trend: {latest_trend}",
            f"Tracked skills: {len(skill_report)}",
            "",
            "Open the Reports dashboard to explore detailed skill gaps and trends.",
        ]
    )
    send_email_async("Weekly Report Digest", body, get_user_email_for_notifications(session, user))
    set_state(session, state_key, week_key)


def load_resume_for_employee(session, employee_id: str) -> dict[str, Any]:
    assessments = session.scalars(select(AssessmentRecord).where(AssessmentRecord.employee_id == employee_id)).all()
    assessments = sorted(assessments, key=lambda item: item.date or "", reverse=True)
    if assessments:
        latest_resume = loads_json(assessments[0].resume_json, {})
        if isinstance(latest_resume, dict) and latest_resume.get("fileName"):
            return latest_resume

    per_user_journey = get_state(session, employee_journey_state_key(employee_id), {})
    if isinstance(per_user_journey, dict):
        per_user_resume = per_user_journey.get("resume", {})
        if isinstance(per_user_resume, dict) and per_user_resume.get("fileName"):
            return per_user_resume

    journey = get_state(session, "employeeJourney", DEFAULT_EMPLOYEE_JOURNEY)
    profile = journey.get("profile", {})
    resume = journey.get("resume", {})
    if profile.get("employeeId") == employee_id and isinstance(resume, dict) and resume.get("fileName"):
        return resume

    raise HTTPException(status_code=404, detail="Resume not found for this employee")


def update_resume_for_employee(session, employee_id: str, resume_payload: dict[str, Any]) -> dict[str, Any]:
    assessments = session.scalars(select(AssessmentRecord).where(AssessmentRecord.employee_id == employee_id)).all()
    updated_any = False
    if assessments:
        for item in assessments:
            item.resume_json = dumps_json(resume_payload)
        updated_any = True

    per_user_journey = get_state(session, employee_journey_state_key(employee_id), {})
    if not isinstance(per_user_journey, dict) or not per_user_journey:
        per_user_journey = deepcopy(DEFAULT_EMPLOYEE_JOURNEY)
    per_user_profile = per_user_journey.get("profile", {})
    if not isinstance(per_user_profile, dict):
        per_user_profile = {}
    per_user_profile["employeeId"] = employee_id
    per_user_journey["profile"] = per_user_profile
    per_user_journey["resume"] = resume_payload
    set_state(session, employee_journey_state_key(employee_id), per_user_journey)
    updated_any = True

    journey = get_state(session, "employeeJourney", DEFAULT_EMPLOYEE_JOURNEY)
    profile = journey.get("profile", {})
    if profile.get("employeeId") == employee_id:
        journey["resume"] = resume_payload
        set_state(session, "employeeJourney", journey)
        updated_any = True

    if not updated_any:
        raise HTTPException(status_code=404, detail="Employee resume record not found")

    return resume_payload


def decode_resume_payload(resume: dict[str, Any]) -> tuple[bytes, str, str]:
    file_data = str(resume.get("fileData", "")).strip()
    if not file_data:
        raise HTTPException(status_code=404, detail="Resume file is missing")

    encoded_payload = file_data.split(",", 1)[1] if "," in file_data else file_data
    try:
        file_bytes = base64.b64decode(encoded_payload)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(status_code=400, detail="Resume file could not be decoded") from exc

    file_name = str(resume.get("fileName") or "resume")
    safe_file_name = file_name.replace('"', "").replace("\r", "").replace("\n", "")
    media_type = str(resume.get("contentType") or "application/octet-stream")
    return file_bytes, media_type, safe_file_name


def is_pdf_resume(payload: dict[str, Any]) -> bool:
    file_name = str(payload.get("fileName") or "").lower()
    content_type = str(payload.get("contentType") or "").lower()
    file_data = str(payload.get("fileData") or "")
    if file_name and not file_name.endswith(".pdf"):
        return False
    if content_type and content_type != "application/pdf":
        return False
    if file_data and file_data.startswith("data:") and not file_data.startswith("data:application/pdf;base64,"):
        return False
    return True


def start_interview_chat_session(journey: dict[str, Any]) -> dict[str, Any]:
    questions = build_questions(journey.get("domains", []), merge_resume_skills(journey))
    resume_question = build_resume_focus_question(journey)
    if resume_question:
        questions = [resume_question, *questions]
    if not questions:
        questions = [
            {
                "id": "general-intro",
                "domainId": "general",
                "question": "Tell me about your most technically challenging project and your exact contribution.",
                "hint": "Include architecture choices, constraints, and measurable outcomes.",
            }
        ]

    session_id = f"chat-{uuid4().hex[:12]}"
    opener = {
        "id": f"msg-{uuid4().hex[:10]}",
        "role": "assistant",
        "text": f"Let's begin. {questions[0]['question']}",
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    return {
        "sessionId": session_id,
        "questions": questions,
        "currentIndex": 0,
        "followUpAsked": False,
        "messages": [opener],
        "answers": [],
        "canComplete": False,
        "qualitySignals": {"turns": 0, "totalWords": 0},
        "proctoring": {
            "warningCount": 0,
            "maxWarnings": 3,
            "blocked": False,
            "cancelled": False,
            "lastPersonCount": 1,
            "lastEventAt": "",
            "lastManagerNoticeWarning": 0,
            "events": [],
        },
        "context": build_interview_context(journey),
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def normalize_interview_text(text: str) -> str:
    return " ".join(str(text or "").strip().split())


def count_keyword_hits(text: str, keywords: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for keyword in keywords if keyword in lowered)


def missing_answer_dimensions(answer: str) -> list[str]:
    lowered = answer.lower()
    dimensions = {
        "architecture": ["architecture", "design", "component", "service", "module", "structure"],
        "tradeoffs": ["tradeoff", "constraint", "because", "decision", "pros", "cons", "instead"],
        "outcomes": ["impact", "improved", "reduced", "increased", "latency", "performance", "%", "result"],
        "execution": ["implemented", "built", "coded", "debugged", "deployed", "tested"],
    }
    missing = [name for name, keywords in dimensions.items() if count_keyword_hits(lowered, keywords) == 0]
    return missing


def low_domain_relevance(current_question: dict[str, Any] | None, answer: str) -> bool:
    if not current_question:
        return False
    domain_id = str(current_question.get("domainId") or "").strip().lower()
    if not domain_id:
        return False
    domain_keywords: dict[str, list[str]] = {
        "frontend": ["react", "typescript", "javascript", "css", "component", "ui"],
        "backend": ["api", "fastapi", "service", "auth", "cache", "database", "python", "node"],
        "database": ["sql", "postgres", "mysql", "query", "schema", "index"],
        "devops": ["docker", "kubernetes", "ci", "cd", "aws", "terraform", "deploy"],
        "mobile": ["android", "ios", "flutter", "react native", "swift", "kotlin"],
        "data-ai": ["model", "llm", "prompt", "vector", "ml", "etl", "pandas"],
        "qa": ["test", "coverage", "playwright", "cypress", "regression", "automation"],
        "security": ["owasp", "jwt", "rbac", "threat", "secret", "compliance"],
    }
    keywords = domain_keywords.get(domain_id, [])
    if not keywords:
        return False
    return count_keyword_hits(answer.lower(), keywords) == 0


def get_interviewer_followup(current_question: dict[str, Any] | None, answer: str, follow_up_asked: bool) -> str | None:
    words = len(answer.split())
    lower = answer.lower()
    low_effort_markers = ["idk", "i don't know", "dont know", "no idea", "blah", "whatever", "not sure"]
    if any(marker in lower for marker in low_effort_markers) and not follow_up_asked:
        return "Take a moment and answer with a real example: what exactly you built, one key technical decision, and the measurable outcome."
    if low_domain_relevance(current_question, answer) and not follow_up_asked:
        return "This answer seems off-domain. Please answer with a concrete example specifically in this domain, including technologies used, your decisions, and measurable impact."
    if words < 18 and not follow_up_asked:
        return "Please go deeper with one concrete project example, including what you implemented and how you measured success."
    missing = missing_answer_dimensions(answer)
    if not follow_up_asked and len(missing) >= 2:
        focus = ", ".join(missing[:2])
        return f"Good start. Before we move on, add specific detail on {focus} for this example."
    if not follow_up_asked and current_question and str(current_question.get("id", "")).endswith("-gap"):
        if count_keyword_hits(lower, ["learn", "practice", "plan", "week", "month", "mentor", "course"]) == 0:
            return "What is your exact improvement plan for the next 4-6 weeks, and how will you measure progress?"
    return None


def generate_professional_interviewer_reply(
    chat_state: dict[str, Any],
    current_question: dict[str, Any] | None,
    user_answer: str,
    next_question: str | None = None,
    can_complete: bool = False,
) -> str | None:
    recent_messages = chat_state.get("messages", [])[-8:]
    transcript_lines = []
    for item in recent_messages:
        role = "Candidate" if item.get("role") == "user" else "Interviewer"
        transcript_lines.append(f"{role}: {str(item.get('text', '')).strip()}")
    transcript = "\n".join(transcript_lines[-8:])
    current_question_text = str(current_question.get("question", "")) if current_question else ""
    context = chat_state.get("context", {}) if isinstance(chat_state.get("context"), dict) else {}
    context_blob = (
        f"Target domains: {', '.join(context.get('domains', []) or [])}\n"
        f"Target skills: {', '.join(context.get('skills', []) or [])}\n"
        f"Candidate role: {context.get('role', '')}\n"
        f"Candidate level: {context.get('experienceLevel', '')}\n"
        f"Years experience: {context.get('yearsExperience', '')}\n"
        f"Profile summary: {context.get('profileSummary', '')}\n"
        f"Resume excerpt: {(context.get('resumeExcerpt') or '')[:1200]}\n"
    )

    instruction = (
        "You are a senior technical interviewer. Keep tone professional, specific, and concise. "
        "Ask one strong follow-up question that probes architecture decisions, tradeoffs, debugging approach, and measurable outcomes. "
        "Avoid childish phrasing. Do not praise excessively. Keep it under 45 words."
    )
    if next_question:
        instruction += f" Transition cleanly into this next planned question: '{next_question}'."
    if can_complete:
        instruction += " If evidence is sufficient, instruct candidate to finish interview professionally."

    prompt = (
        f"Current question: {current_question_text}\n"
        f"Candidate answer: {user_answer}\n"
        f"Candidate context:\n{context_blob}\n"
        f"Recent transcript:\n{transcript}\n"
        "Return only the interviewer next message."
    )

    gemini_reply = generate_gemini_text(
        system_instruction=instruction,
        user_prompt=prompt,
        temperature=0.35,
        max_output_tokens=180,
    )
    if gemini_reply:
        return gemini_reply

    client = get_openai_client()
    if client is None:
        return None

    try:
        response = client.responses.create(
            model=OPENAI_MODEL,
            input=[
                {"role": "system", "content": instruction},
                {"role": "user", "content": prompt},
            ],
            max_output_tokens=140,
            temperature=0.35,
        )
        text = (getattr(response, "output_text", "") or "").strip()
        return text or None
    except Exception:
        return None


def refine_evaluation_with_gemini(
    base_result: dict[str, Any],
    journey: dict[str, Any],
    answers: list[dict[str, Any]],
) -> dict[str, Any]:
    context = build_interview_context(journey)
    resume_excerpt = (context.get("resumeExcerpt") or "")[:2000]
    answer_digest = []
    for item in answers[:12]:
        question = str(item.get("question") or "")
        answer = str(item.get("answer") or "")
        answer_digest.append({"domainId": item.get("domainId"), "question": question[:180], "answer": answer[:420]})

    instruction = (
        "You are a strict senior technical interviewer and evaluator. "
        "Return a single JSON object only with keys: "
        "overallScore, summary, strengths, gaps, recommendations, hiringSignal, confidence, perDomain. "
        "Scoring scale is 1.0 to 5.0. Penalize vague answers heavily. "
        "perDomain is an array of objects: id,title,score,gapLevel,strengths,concerns."
    )
    prompt = json.dumps(
        {
            "currentResult": base_result,
            "candidateContext": {
                "domains": context.get("domains", []),
                "skills": context.get("skills", []),
                "profileSummary": context.get("profileSummary", ""),
                "role": context.get("role", ""),
                "experienceLevel": context.get("experienceLevel", ""),
                "yearsExperience": context.get("yearsExperience", ""),
                "resumeFileName": context.get("resumeFileName", ""),
                "resumeExcerpt": resume_excerpt,
            },
            "answers": answer_digest,
        },
        ensure_ascii=True,
    )

    response_text = generate_gemini_text(
        system_instruction=instruction,
        user_prompt=prompt,
        temperature=0.2,
        max_output_tokens=1300,
    )
    if not response_text:
        return base_result

    parsed = extract_json_object(response_text)
    if not parsed:
        return base_result

    result = deepcopy(base_result)
    overall = parsed.get("overallScore")
    if isinstance(overall, (int, float)):
        result["score"] = round(max(1.0, min(5.0, float(overall))), 1)

    summary = str(parsed.get("summary") or "").strip()
    if summary:
        result["summary"] = summary

    for key in ("strengths", "gaps", "recommendations"):
        value = parsed.get(key)
        if isinstance(value, list):
            result[key] = [str(item).strip() for item in value if str(item).strip()][:5]

    hiring_signal = str(parsed.get("hiringSignal") or "").strip()
    if hiring_signal:
        result["hiringSignal"] = hiring_signal
    confidence = str(parsed.get("confidence") or "").strip()
    if confidence:
        result["confidence"] = confidence

    per_domain = parsed.get("perDomain")
    if isinstance(per_domain, list) and per_domain:
        normalized_domains: list[dict[str, Any]] = []
        for domain in per_domain:
            if not isinstance(domain, dict):
                continue
            title = str(domain.get("title") or "").strip()
            if not title:
                continue
            score = domain.get("score")
            safe_score = float(score) if isinstance(score, (int, float)) else 1.0
            normalized_domains.append(
                {
                    "id": str(domain.get("id") or title.lower().replace(" ", "-")),
                    "title": title,
                    "score": round(max(1.0, min(5.0, safe_score)), 1),
                    "gapLevel": str(domain.get("gapLevel") or "Medium"),
                    "strengths": [str(item).strip() for item in domain.get("strengths", []) if str(item).strip()][:3],
                    "concerns": [str(item).strip() for item in domain.get("concerns", []) if str(item).strip()][:3],
                    "evidence": domain.get("evidence", []) if isinstance(domain.get("evidence", []), list) else [],
                }
            )
        if normalized_domains:
            result["perDomain"] = normalized_domains

    result["evaluationMethod"] = "gemini-assisted"
    return result


def apply_chat_turn(chat_state: dict[str, Any], message: str) -> dict[str, Any]:
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    normalized_message = normalize_interview_text(message)
    if not normalized_message:
        assistant = {
            "id": f"msg-{uuid4().hex[:10]}",
            "role": "assistant",
            "text": "I didn't catch that. Please provide a concrete technical answer.",
            "createdAt": now,
        }
        chat_state["messages"].append(assistant)
        chat_state["canComplete"] = False
        return {"assistantMessage": assistant, "canComplete": False}

    user_message = {
        "id": f"msg-{uuid4().hex[:10]}",
        "role": "user",
        "text": normalized_message,
        "createdAt": now,
    }
    chat_state["messages"].append(user_message)

    questions = chat_state.get("questions", [])
    current_index = int(chat_state.get("currentIndex", 0))
    current_question = questions[current_index] if current_index < len(questions) else None
    words = len(normalized_message.split())
    quality = chat_state.setdefault("qualitySignals", {"turns": 0, "totalWords": 0})
    quality["turns"] = int(quality.get("turns", 0)) + 1
    quality["totalWords"] = int(quality.get("totalWords", 0)) + words

    if current_question:
        # Always store candidate evidence first so we do not loop on the same prompt forever.
        existing = next((item for item in chat_state["answers"] if item["questionId"] == current_question["id"]), None)
        if existing:
            existing["answer"] = f"{existing['answer']}\n{normalized_message}".strip()
        else:
            chat_state["answers"].append(
                {
                    "questionId": current_question["id"],
                    "question": current_question["question"],
                    "domainId": current_question.get("domainId"),
                    "answer": normalized_message,
                }
            )

    followup = get_interviewer_followup(current_question, normalized_message, bool(chat_state.get("followUpAsked")))
    if current_question and followup:
        chat_state["followUpAsked"] = True
        assistant_text = generate_professional_interviewer_reply(chat_state, current_question, normalized_message) or followup
        assistant = {"id": f"msg-{uuid4().hex[:10]}", "role": "assistant", "text": assistant_text, "createdAt": now}
        chat_state["messages"].append(assistant)
        chat_state["canComplete"] = False
        return {"assistantMessage": assistant, "canComplete": False}

    chat_state["followUpAsked"] = False

    if current_question and current_index + 1 < len(questions):
        chat_state["currentIndex"] = current_index + 1
        next_question = questions[chat_state["currentIndex"]]
        assistant_text = (
            generate_professional_interviewer_reply(
                chat_state,
                current_question,
                normalized_message,
                next_question=next_question["question"],
                can_complete=False,
            )
            or f"Thanks, that helps. Next question: {next_question['question']}"
        )
        can_complete = False
    else:
        required = max(4, min(8, len(questions)))
        avg_words = int(quality.get("totalWords", 0)) / max(int(quality.get("turns", 1)), 1)
        can_complete = len(chat_state.get("answers", [])) >= required and avg_words >= 26
        if can_complete:
            assistant_text = (
                generate_professional_interviewer_reply(chat_state, current_question, normalized_message, can_complete=True)
                or "Great, I have enough interview evidence. Click finish to generate your full skill and gap report."
            )
        else:
            assistant_text = (
                generate_professional_interviewer_reply(chat_state, current_question, normalized_message)
                or "I need one stronger example before finishing: include architecture choice, tradeoff, and measurable outcome."
            )

    assistant = {"id": f"msg-{uuid4().hex[:10]}", "role": "assistant", "text": assistant_text, "createdAt": now}
    chat_state["messages"].append(assistant)
    chat_state["canComplete"] = can_complete
    return {"assistantMessage": assistant, "canComplete": can_complete}


def save_interview_chat_state(session, chat_state: dict[str, Any]) -> None:
    session_id = chat_state.get("sessionId")
    if not session_id:
        return
    INTERVIEW_CHAT_SESSIONS[session_id] = chat_state
    set_state(session, f"interviewChat:{session_id}", chat_state)


def get_interview_chat_state(session, session_id: str) -> dict[str, Any] | None:
    in_memory = INTERVIEW_CHAT_SESSIONS.get(session_id)
    if in_memory:
        return in_memory
    persisted = get_state(session, f"interviewChat:{session_id}", {})
    if persisted and persisted.get("sessionId"):
        INTERVIEW_CHAT_SESSIONS[session_id] = persisted
        return persisted
    return None


def generate_totp_secret() -> str:
    # 20 bytes => 32 base32 chars without padding
    return base64.b32encode(secrets.token_bytes(20)).decode("utf-8").rstrip("=")


def hotp(secret: str, counter: int, digits: int = 6) -> str:
    key = base64.b32decode(secret + "=" * ((8 - len(secret) % 8) % 8))
    msg = struct.pack(">Q", counter)
    h = hmac.new(key, msg, "sha1").digest()
    offset = h[-1] & 0x0F
    code = (struct.unpack(">I", h[offset : offset + 4])[0] & 0x7FFFFFFF) % (10**digits)
    return str(code).zfill(digits)


def verify_totp_code(secret: str, code: str, interval: int = 30, window: int = TOTP_WINDOW) -> bool:
    if not code or not code.isdigit():
        return False
    try:
        code_int = int(code)
    except ValueError:
        return False
    timestamp = int(time.time() / interval)
    for offset in range(-window, window + 1):
        if hotp(secret, timestamp + offset) == str(code_int).zfill(6):
            return True
    return False


def totp_status(session, user_id: str) -> dict[str, Any]:
    state = get_state(session, f"totp:{user_id}", {"enabled": False, "secret": ""})
    return {"enabled": bool(state.get("enabled")), "hasSecret": bool(state.get("secret"))}


def set_totp_state(session, user_id: str, secret: str, enabled: bool) -> dict[str, Any]:
    set_state(session, f"totp:{user_id}", {"enabled": enabled, "secret": secret})
    return {"enabled": enabled, "hasSecret": bool(secret)}


def serialize_notification(record: NotificationRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "title": record.title,
        "message": record.message,
        "time": record.time_label,
        "read": record.is_read,
        "category": record.category or "general",
        "createdAt": record.created_at or "",
    }


def serialize_employee(record: EmployeeRecord) -> dict[str, Any]:
    return {"id": record.id, "name": record.name, "email": record.email, "role": record.role, "skills": loads_json(record.skills_json, []), "skillLevel": record.skill_level, "status": record.status, "lastAssessment": record.last_assessment}


def normalize_role_key(value: Any) -> str:
    role_text = str(value or "").strip().lower()
    return "".join(char for char in role_text if char.isalnum())


def build_role_members(role_name: str, employees: list[dict[str, Any]]) -> list[dict[str, Any]]:
    expected_key = normalize_role_key(role_name)
    if not expected_key:
        return []
    return [
        {
            "id": employee["id"],
            "name": employee["name"],
            "email": employee["email"],
            "status": employee["status"],
            "skillLevel": employee["skillLevel"],
        }
        for employee in employees
        if normalize_role_key(employee.get("role")) == expected_key
    ]


def serialize_role(record: RoleRecord, members: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    member_list = members or []
    return {
        "id": record.id,
        "name": record.name,
        "requiredSkills": loads_json(record.required_skills_json, []),
        "employees": len(member_list),
        "members": member_list,
        "avgScore": record.avg_score,
        "readiness": record.readiness,
        "topGap": record.top_gap,
        "lastReview": record.last_review,
    }


def normalize_team_required_skills(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    for item in value:
        if isinstance(item, dict):
            name = str(item.get("name") or "").strip()
        else:
            name = str(item or "").strip()
        if name:
            normalized.append(name)
    return list(dict.fromkeys(normalized))[:20]


def parse_years_experience(value: Any) -> float:
    raw = str(value or "").strip()
    cleaned = "".join(char for char in raw if char.isdigit() or char == ".")
    if cleaned.count(".") > 1:
        cleaned = cleaned.replace(".", "", cleaned.count(".") - 1)
    try:
        years = float(cleaned)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(25.0, years))


def serialize_team(record: TeamRecord, employees_by_id: dict[int, dict[str, Any]] | None = None) -> dict[str, Any]:
    required_skills = normalize_team_required_skills(loads_json(record.required_skills_json, []))
    raw_member_ids = loads_json(record.member_employee_ids_json, [])
    member_ids: list[int] = []
    for item in raw_member_ids if isinstance(raw_member_ids, list) else []:
        try:
            parsed = int(item)
        except (TypeError, ValueError):
            continue
        if parsed not in member_ids:
            member_ids.append(parsed)

    members: list[dict[str, Any]] = []
    if employees_by_id:
        for member_id in member_ids:
            member = employees_by_id.get(member_id)
            if member:
                members.append(member)

    return {
        "id": record.id,
        "name": record.name,
        "roleFocus": record.role_focus,
        "description": record.description,
        "requiredSkills": required_skills,
        "targetSize": int(record.target_size or 4),
        "memberEmployeeIds": member_ids,
        "members": members,
        "createdAt": record.created_at,
        "updatedAt": record.updated_at,
    }


def build_team_suggestions(session, team: TeamRecord) -> list[dict[str, Any]]:
    employees = [serialize_employee(item) for item in session.scalars(select(EmployeeRecord).order_by(EmployeeRecord.skill_level.desc())).all()]
    if not employees:
        return []

    users = session.scalars(select(UserRecord).where(UserRecord.role == "employee")).all()
    user_by_email = {str(user.email or "").strip().lower(): user for user in users}
    user_ids = [user.id for user in users]
    state_rows = (
        session.scalars(select(AppStateRecord).where(AppStateRecord.state_key.in_([employee_journey_state_key(user_id) for user_id in user_ids])))
        .all()
        if user_ids
        else []
    )
    journey_state = {row.state_key: loads_json(row.payload, {}) for row in state_rows}

    assessment_rows = (
        session.execute(
            select(
                AssessmentRecord.employee_id,
                AssessmentRecord.date,
                AssessmentRecord.selected_skills_json,
                AssessmentRecord.gaps_json,
            ).where(AssessmentRecord.employee_id.in_(user_ids))
        ).all()
        if user_ids
        else []
    )
    latest_assessment: dict[str, dict[str, Any]] = {}
    latest_assessment_sort_key: dict[str, tuple[float, str]] = {}
    for row in assessment_rows:
        employee_id = str(row.employee_id or "").strip()
        if not employee_id:
            continue
        date_value = str(row.date or "").strip()
        parsed = parse_iso_datetime(date_value)
        sort_key = (parsed.timestamp() if parsed else 0.0, date_value)
        previous = latest_assessment_sort_key.get(employee_id)
        if previous is not None and sort_key <= previous:
            continue
        latest_assessment_sort_key[employee_id] = sort_key
        latest_assessment[employee_id] = {
            "skills": normalize_team_required_skills(loads_json(row.selected_skills_json, [])),
            "gaps": normalize_team_required_skills(loads_json(row.gaps_json, [])),
        }

    required_skills = normalize_team_required_skills(loads_json(team.required_skills_json, []))
    required_lower = {skill.lower(): skill for skill in required_skills}
    fallback_target_size = int(team.target_size or 4) if int(team.target_size or 4) > 0 else 4
    limit = max(2, min(12, fallback_target_size * 2))

    suggestions: list[dict[str, Any]] = []
    for employee in employees:
        employee_email = str(employee.get("email") or "").strip().lower()
        user = user_by_email.get(employee_email)
        journey = journey_state.get(employee_journey_state_key(user.id), {}) if user else {}
        profile = journey.get("profile", {}) if isinstance(journey.get("profile"), dict) else {}
        resume_analysis = journey.get("resumeAnalysis", {}) if isinstance(journey.get("resumeAnalysis"), dict) else {}
        job_match = journey.get("jobMatchAnalysis", {}) if isinstance(journey.get("jobMatchAnalysis"), dict) else {}
        assessment = latest_assessment.get(user.id, {}) if user else {}

        skill_pool = set()
        for skill in normalize_team_required_skills(employee.get("skills", [])):
            skill_pool.add(skill.lower())
        for skill in normalize_team_required_skills(resume_analysis.get("skills", [])):
            skill_pool.add(skill.lower())
        for skill in normalize_team_required_skills(assessment.get("skills", [])):
            skill_pool.add(skill.lower())

        matched = [name for lower, name in required_lower.items() if lower in skill_pool]
        missing = [name for lower, name in required_lower.items() if lower not in skill_pool]
        skill_match_ratio = len(matched) / max(len(required_lower), 1) if required_lower else 0.5

        skill_level = max(0.0, min(5.0, float(employee.get("skillLevel") or 0)))
        level_ratio = skill_level / 5
        years = parse_years_experience(profile.get("yearsExperience"))
        years_ratio = min(years / 10.0, 1.0)
        gap_count = len(normalize_team_required_skills(assessment.get("gaps", [])))
        job_missing = len(normalize_team_required_skills(job_match.get("missingSkills", [])))
        risk_penalty = min(gap_count + job_missing, 8) * 0.035
        status = str(employee.get("status") or "").strip().lower()
        status_boost = 0.06 if status == "active" else 0.0

        fit_raw = (skill_match_ratio * 0.52) + (level_ratio * 0.28) + (years_ratio * 0.14) + status_boost - risk_penalty
        fit_score = round(max(0.0, min(1.0, fit_raw)) * 100, 1)

        rationale = []
        if matched:
            rationale.append(f"Matches key skills: {', '.join(matched[:4])}.")
        if missing:
            rationale.append(f"Needs coverage in: {', '.join(missing[:3])}.")
        if years:
            rationale.append(f"Experience signal: {years:g} years.")
        if gap_count or job_missing:
            rationale.append(f"Risk flags from gaps/missing evidence: {gap_count + job_missing}.")

        suggestions.append(
            {
                "employeeId": employee.get("id"),
                "name": employee.get("name"),
                "email": employee.get("email"),
                "role": employee.get("role"),
                "status": status or "pending",
                "skillLevel": round(skill_level, 1),
                "experienceYears": years,
                "fitScore": fit_score,
                "matchedSkills": matched,
                "missingSkills": missing,
                "gapCount": gap_count + job_missing,
                "rationale": rationale[:3],
            }
        )

    suggestions.sort(key=lambda item: (float(item.get("fitScore") or 0), float(item.get("skillLevel") or 0)), reverse=True)
    return suggestions[:limit]


def serialize_assessment(record: AssessmentRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "source": record.source,
        "title": record.title,
        "employee": record.employee,
        "employeeId": record.employee_id,
        "status": record.status,
        "score": record.score,
        "date": record.date,
        "duration": record.duration,
        "interviewer": record.interviewer,
        "focusArea": record.focus_area,
        "summary": record.summary,
        "highlights": loads_json(record.highlights_json, []),
        "perDomain": loads_json(record.per_domain_json, []),
        "answers": loads_json(record.answers_json, []),
        "profile": loads_json(record.profile_json, {}),
        "resume": loads_json(record.resume_json, {}),
        "selectedSkills": loads_json(record.selected_skills_json, []),
        "strengths": loads_json(record.strengths_json, []),
        "gaps": loads_json(record.gaps_json, []),
        "recommendations": loads_json(record.recommendations_json, []),
        "hiringSignal": record.hiring_signal,
        "confidence": record.confidence,
        "evaluationMethod": record.evaluation_method,
        "shareEnabled": bool(record.share_enabled),
        "shareCreatedAt": record.share_created_at,
    }


def serialize_assessment_for_share(record: AssessmentRecord) -> dict[str, Any]:
    payload = serialize_assessment(record)
    resume = payload.get("resume") or {}
    if isinstance(resume, dict):
        resume.pop("fileData", None)
    payload["resume"] = resume
    payload.pop("answers", None)
    return payload


def build_assessment_pdf(payload: dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    pdf.setFillColor(colors.HexColor("#0f172a"))
    pdf.rect(0, 0, width, height, stroke=0, fill=1)

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(72, height - 72, "Interview Report")
    pdf.setFont("Helvetica", 11)
    pdf.setFillColor(colors.HexColor("#cbd5f5"))
    pdf.drawString(72, height - 94, f"Employee: {payload.get('employee', 'Employee')}")
    pdf.drawString(72, height - 110, f"Generated: {payload.get('date', '-')}")

    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(72, height - 150, f"Overall Score: {payload.get('score', 0):.1f}/5")
    pdf.setFont("Helvetica", 11)
    pdf.drawString(72, height - 168, f"Hiring Signal: {payload.get('hiringSignal', 'Pending')}")
    pdf.drawString(72, height - 184, f"Confidence: {payload.get('confidence', 'Medium')}")

    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(72, height - 220, "Summary")
    pdf.setFont("Helvetica", 10)
    summary = str(payload.get("summary", "") or "")
    text = pdf.beginText(72, height - 236)
    text.setLeading(14)
    for line in split_text(summary, 90):
        text.textLine(line)
    pdf.drawText(text)

    y = height - 320
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(72, y, "Strengths")
    y -= 16
    pdf.setFont("Helvetica", 10)
    for item in payload.get("strengths", [])[:6]:
        pdf.drawString(84, y, f"- {item}")
        y -= 14

    y -= 8
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(72, y, "Key Gaps")
    y -= 16
    pdf.setFont("Helvetica", 10)
    for item in payload.get("gaps", [])[:6]:
        pdf.drawString(84, y, f"- {item}")
        y -= 14

    y -= 8
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(72, y, "Recommended Next Steps")
    y -= 16
    pdf.setFont("Helvetica", 10)
    for item in payload.get("recommendations", [])[:5]:
        label = item.get("title") if isinstance(item, dict) else str(item)
        pdf.drawString(84, y, f"- {label}")
        y -= 14

    pdf.setFillColor(colors.HexColor("#64748b"))
    pdf.setFont("Helvetica", 8)
    pdf.drawString(72, 36, "Generated by SkillSenseAI. Confidential & intended for the employee.")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer.read()


def split_text(text: str, max_chars: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        if sum(len(token) for token in current) + len(word) + len(current) > max_chars:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return lines


def serialize_rubric(record: RubricTemplateRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "name": record.name,
        "description": record.description,
        "competencies": loads_json(record.competencies_json, []),
        "createdAt": record.created_at,
    }


def serialize_assessment_template(record: AssessmentTemplateRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "title": record.title,
        "description": record.description,
        "category": record.category,
        "questions": loads_json(record.questions_json, []),
        "rubricId": record.rubric_id,
        "createdAt": record.created_at,
    }


def serialize_assessment_attempt(record: AssessmentAttemptRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "templateId": record.template_id,
        "employeeId": record.employee_id,
        "status": record.status,
        "startedAt": record.started_at,
        "submittedAt": record.submitted_at,
        "answers": loads_json(record.answers_json, []),
        "score": record.score,
        "result": loads_json(record.result_json, {}),
    }


def compute_template_score(questions: list[dict[str, Any]], answers: list[dict[str, Any]]) -> tuple[float, dict[str, Any]]:
    total = 0
    correct = 0
    text_hits = 0
    for question in questions:
        qid = question.get("id")
        answer = next((item for item in answers if item.get("id") == qid), {})
        qtype = question.get("type", "text")
        if qtype == "mcq":
            total += 1
            if answer.get("answer") == question.get("correctIndex"):
                correct += 1
        elif qtype == "text":
            total += 1
            keywords = [str(item).lower() for item in question.get("keywords", []) if item]
            response = str(answer.get("answer", "")).lower()
            if keywords and any(keyword in response for keyword in keywords):
                correct += 1
                text_hits += 1
    normalized = 0.0 if total == 0 else round((correct / total) * 5, 2)
    return normalized, {"total": total, "correct": correct, "textHits": text_hits}


def normalize_competencies(raw: Any) -> list[dict[str, Any]]:
    competencies = raw if isinstance(raw, list) else []
    cleaned: list[dict[str, Any]] = []
    for item in competencies:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        description = str(item.get("description", "")).strip()
        try:
            weight = int(item.get("weight", 1))
        except (TypeError, ValueError):
            weight = 1
        weight = max(1, min(5, weight))
        cleaned.append({"name": name, "weight": weight, "description": description})
    return cleaned


def normalize_questions(raw: Any) -> list[dict[str, Any]]:
    questions = raw if isinstance(raw, list) else []
    cleaned: list[dict[str, Any]] = []
    for index, item in enumerate(questions):
        if not isinstance(item, dict):
            continue
        prompt = str(item.get("prompt", "")).strip()
        if not prompt:
            continue
        qtype = str(item.get("type", "text")).strip().lower()
        qid = str(item.get("id") or f"q{index + 1}")
        if qtype not in ("mcq", "text"):
            qtype = "text"
        if qtype == "mcq":
            options = [str(opt).strip() for opt in (item.get("options") or []) if str(opt).strip()]
            if len(options) < 2:
                continue
            try:
                correct_index = int(item.get("correctIndex", 0))
            except (TypeError, ValueError):
                correct_index = 0
            if correct_index < 0 or correct_index >= len(options):
                correct_index = 0
            cleaned.append(
                {
                    "id": qid,
                    "type": "mcq",
                    "prompt": prompt,
                    "options": options,
                    "correctIndex": correct_index,
                    "keywords": [],
                }
            )
        else:
            keywords = [str(keyword).strip() for keyword in (item.get("keywords") or []) if str(keyword).strip()]
            cleaned.append(
                {
                    "id": qid,
                    "type": "text",
                    "prompt": prompt,
                    "options": [],
                    "correctIndex": 0,
                    "keywords": keywords,
                }
            )
    return cleaned


def is_interview_record(record: AssessmentRecord) -> bool:
    return record.source == "employee-interview" or bool(loads_json(record.answers_json, []))


def parse_record_datetime(value: str) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        if raw.endswith("Z"):
            raw = raw.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=UTC)
        return parsed.astimezone(UTC)
    except ValueError:
        return None


def get_interview_retention_policy(session) -> dict[str, Any]:
    current = get_state(session, "interviewRetentionPolicy", {"enabled": False, "window": "1month"})
    enabled = bool(current.get("enabled", False))
    window = str(current.get("window", "1month"))
    if window not in INTERVIEW_RETENTION_WINDOWS:
        window = "1month"
    return {"enabled": enabled, "window": window}


def prune_expired_interview_logs(session, policy: dict[str, Any]) -> int:
    if not policy.get("enabled"):
        return 0
    window = str(policy.get("window", "1month"))
    delta = INTERVIEW_RETENTION_WINDOWS.get(window)
    if delta is None:
        return 0
    cutoff = datetime.now(UTC) - delta
    deleted = 0
    for record in session.scalars(select(AssessmentRecord)).all():
        if not is_interview_record(record):
            continue
        parsed = parse_record_datetime(record.date)
        if parsed and parsed < cutoff:
            session.delete(record)
            deleted += 1
    return deleted


def build_dynamic_reports(session) -> dict[str, Any]:
    assessments = [
        serialize_assessment(item)
        for item in session.scalars(select(AssessmentRecord)).all()
        if item.status == "completed" and item.score and item.source != "seeded" and (item.employee_id or item.employee)
    ]
    if not assessments:
        return {"trendData": [], "skillReport": []}

    monthly: dict[str, dict[str, Any]] = {}
    skill_groups: dict[str, dict[str, Any]] = {}

    for item in assessments:
      month = item["date"][:7]
      bucket = monthly.setdefault(month, {"month": month, "scores": [], "completed": 0})
      bucket["scores"].append(item["score"])
      bucket["completed"] += 1

      skills = item.get("selectedSkills") or [item.get("focusArea")] if item.get("focusArea") else []
      for skill in skills:
        if not skill:
          continue
        group = skill_groups.setdefault(
            skill,
            {"skill": skill, "scores": [], "employees": set(), "employeeDetails": {}},
        )
        group["scores"].append(item["score"])
        employee_name = str(item.get("employee") or "").strip()
        employee_id = str(item.get("employeeId") or "").strip()
        if employee_name:
          group["employees"].add(employee_name)
        if employee_id or employee_name:
          detail_key = employee_id or employee_name
          existing = group["employeeDetails"].get(detail_key)
          current_date = parse_record_datetime(item.get("date", ""))
          existing_date = parse_record_datetime(existing.get("date", "")) if isinstance(existing, dict) else None
          if not existing or (current_date and (not existing_date or current_date > existing_date)):
            group["employeeDetails"][detail_key] = {
                "employeeId": employee_id,
                "name": employee_name or "Employee",
                "score": round(float(item.get("score") or 0), 1),
                "date": item.get("date", ""),
            }

    trend_data = [
        {
            "month": bucket["month"],
            "avgScore": round(sum(bucket["scores"]) / len(bucket["scores"]), 1),
            "completed": bucket["completed"],
        }
        for bucket in sorted(monthly.values(), key=lambda entry: entry["month"])
    ]

    skill_report = sorted(
        [
            {
                "skill": group["skill"],
                "employees": len(group["employees"]),
                "avgScore": round(sum(group["scores"]) / len(group["scores"]), 1),
                "gap": round(max(0, 5 - (sum(group["scores"]) / len(group["scores"]))), 1),
                "employeeDetails": sorted(
                    group["employeeDetails"].values(),
                    key=lambda entry: entry.get("score", 0),
                    reverse=True,
                ),
            }
            for group in skill_groups.values()
        ],
        key=lambda item: item["avgScore"],
    )

    return {"trendData": trend_data, "skillReport": skill_report[:10]}


def build_dynamic_leaderboard(session) -> dict[str, Any]:
    assessments = [
        serialize_assessment(item)
        for item in session.scalars(select(AssessmentRecord)).all()
        if item.status == "completed" and item.score and item.employee
    ]
    if not assessments:
        return DEFAULT_STORE["leaderboard"]

    grouped: dict[str, dict[str, Any]] = {}
    for item in assessments:
        key = item["employee"]
        profile = item.get("profile") or {}
        group = grouped.setdefault(
            key,
            {
                "name": item["employee"],
                "department": profile.get("department", "Engineering"),
                "scores": [],
                "skills": set(),
                "achievements": 0,
            },
        )
        group["scores"].append(item["score"])
        for skill in item.get("selectedSkills", []):
            group["skills"].add(skill)
        if item["score"] >= 4.5:
            group["achievements"] += 1

    ordered = sorted(
        [
            {
                "name": name,
                "department": data["department"],
                "score": round(sum(data["scores"]) / len(data["scores"]), 1),
                "skills": len(data["skills"]),
                "points": int(round(sum(data["scores"]) * 250)),
                "avatar": "".join(part[0] for part in name.split()[:2]).upper(),
                "achievements": max(1, data["achievements"]),
            }
            for name, data in grouped.items()
        ],
        key=lambda item: (item["score"], item["points"]),
        reverse=True,
    )

    leaderboard = [
        {
            "rank": index + 1,
            "name": item["name"],
            "department": item["department"],
            "score": item["score"],
            "skills": item["skills"],
            "points": item["points"],
        }
        for index, item in enumerate(ordered)
    ]

    top_performers = [
        {
            "rank": index + 1,
            "name": item["name"],
            "score": item["score"],
            "skills": item["skills"],
            "avatar": item["avatar"],
            "achievements": item["achievements"],
        }
        for index, item in enumerate(ordered[:3])
    ]

    skill_leader_map: dict[str, dict[str, Any]] = {}
    for item in assessments:
        for skill in item.get("selectedSkills", [])[:8]:
            current = skill_leader_map.get(skill)
            if not current or item["score"] > current["score"]:
                skill_leader_map[skill] = {
                    "skill": skill,
                    "leader": item["employee"],
                    "score": item["score"],
                }

    achievements = [
        {"id": 1, "name": "Skill Master", "count": len([item for item in ordered if item["score"] >= 4.5]), "icon": "Trophy"},
        {"id": 2, "name": "Quick Learner", "count": len([item for item in ordered if item["score"] >= 4.0]), "icon": "Bolt"},
        {"id": 3, "name": "All Star", "count": len([item for item in ordered if item["skills"] >= 3]), "icon": "Star"},
    ]

    return {
        "topPerformers": top_performers,
        "leaderboard": leaderboard,
        "skillLeaders": list(skill_leader_map.values())[:6] or DEFAULT_STORE["leaderboard"]["skillLeaders"],
        "achievements": achievements,
    }


def build_dynamic_dashboard(session) -> dict[str, Any]:
    employees = [serialize_employee(item) for item in session.scalars(select(EmployeeRecord)).all()]
    assessment_rows = session.execute(
        select(
            AssessmentRecord.status,
            AssessmentRecord.score,
            AssessmentRecord.selected_skills_json,
            AssessmentRecord.date,
            AssessmentRecord.employee,
            AssessmentRecord.summary,
        ).order_by(AssessmentRecord.date.desc())
    ).all()
    assessments = [
        {
            "status": row.status,
            "score": float(row.score or 0),
            "selectedSkills": loads_json(row.selected_skills_json, []),
            "date": row.date or "",
            "employee": row.employee or "Employee",
            "summary": row.summary or "",
        }
        for row in assessment_rows
    ]
    completed = [item for item in assessments if item["status"] == "completed" and item["score"]]

    avg_score = round(sum(item["score"] for item in completed) / max(len(completed), 1), 1)

    skill_scores: dict[str, list[float]] = {}
    for employee in employees:
        for skill in employee.get("skills", []):
            skill_scores.setdefault(skill, []).append(employee.get("skillLevel", 0))
    for item in completed:
        for skill in item.get("selectedSkills", []):
            skill_scores.setdefault(skill, []).append(item["score"])

    skill_gap_data = [
        {
            "skill": skill,
            "current": round(sum(scores) / len(scores), 1),
            "target": 4.5 if round(sum(scores) / len(scores), 1) >= 3.5 else 4.0,
        }
        for skill, scores in list(skill_scores.items())[:6]
    ] or DEFAULT_STORE["dashboard"]["skillGapData"]

    proficient = len([item for item in completed if item["score"] >= 4.3])
    intermediate = len([item for item in completed if 3.2 <= item["score"] < 4.3])
    beginner = len([item for item in completed if item["score"] < 3.2])
    total_buckets = max(proficient + intermediate + beginner, 1)
    skill_distribution = [
        {"name": "Proficient", "value": round((proficient / total_buckets) * 100), "color": "#10b981"},
        {"name": "Intermediate", "value": round((intermediate / total_buckets) * 100), "color": "#f59e0b"},
        {"name": "Beginner", "value": round((beginner / total_buckets) * 100), "color": "#ef4444"},
    ]

    activity_data = [
        {
            "id": index + 1,
            "type": "Assessment Completed" if item["status"] == "completed" else "Assessment Updated",
            "user": item["employee"],
            "time": item["date"][:10],
            "status": "success" if item["score"] >= 4 else "warning" if item["score"] < 3 else "info",
            "details": item["summary"],
        }
        for index, item in enumerate(sorted(assessments, key=lambda entry: entry["date"], reverse=True)[:6])
    ] or DEFAULT_STORE["dashboard"]["activity"]

    return {
        "statsCards": [
            {"title": "Total Employees", "value": str(len(employees)), "change": "+0", "icon": "Users"},
            {"title": "Avg Team Score", "value": f"{avg_score}/5", "change": "+0", "icon": "TrendingUp"},
            {"title": "Skills Tracked", "value": str(len(skill_scores)), "change": "+0", "icon": "Target"},
            {"title": "Completed Assessments", "value": str(len(completed)), "change": "+0", "icon": "Award"},
        ],
        "skillGapData": skill_gap_data,
        "skillDistribution": skill_distribution,
        "activityData": activity_data,
    }


def upsert_assessment(session, payload: dict[str, Any]) -> None:
    record = session.get(AssessmentRecord, payload["id"]) or AssessmentRecord(id=payload["id"])
    record.source = payload.get("source", "employee-interview")
    record.title = payload["title"]
    record.employee = payload["employee"]
    record.employee_id = payload.get("employeeId")
    record.status = payload["status"]
    record.score = float(payload["score"])
    record.date = payload["date"]
    record.duration = payload["duration"]
    record.interviewer = payload["interviewer"]
    record.focus_area = payload["focusArea"]
    record.summary = payload["summary"]
    record.highlights_json = dumps_json(payload.get("highlights", []))
    record.per_domain_json = dumps_json(payload.get("perDomain", []))
    record.answers_json = dumps_json(payload.get("answers", []))
    record.profile_json = dumps_json(payload.get("profile", {}))
    record.resume_json = dumps_json(payload.get("resume", {}))
    record.selected_skills_json = dumps_json(payload.get("selectedSkills", []))
    record.strengths_json = dumps_json(payload.get("strengths", []))
    record.gaps_json = dumps_json(payload.get("gaps", []))
    record.recommendations_json = dumps_json(payload.get("recommendations", []))
    record.hiring_signal = payload.get("hiringSignal", "Pending")
    record.confidence = payload.get("confidence", "Medium")
    record.evaluation_method = payload.get("evaluationMethod", "backend-heuristic")
    session.add(record)


def resolve_user_from_auth(authorization: str | None) -> UserRecord | None:
    cleanup_active_sessions()
    token = get_current_token(authorization)
    if not token:
        return None
    user_id = ACTIVE_SESSIONS.get(token, {}).get("userId")
    if not user_id:
        user_id = decode_user_id_from_token(token)
    if not user_id:
        return None
    with db_session() as session:
        user = session.get(UserRecord, user_id)
    if user:
        ACTIVE_SESSIONS.setdefault(
            token,
            {
                "userId": user.id,
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "device": "Web browser (restored)",
            },
        )
    return user


def employee_journey_state_key(user_id: str) -> str:
    return f"employeeJourney:{user_id}"


def get_employee_journey_for_user(session, user_id: str) -> dict[str, Any]:
    per_user = get_state(session, employee_journey_state_key(user_id), {})
    if isinstance(per_user, dict) and per_user:
        return per_user

    # One-time migration path from legacy global state.
    legacy = get_state(session, "employeeJourney", DEFAULT_EMPLOYEE_JOURNEY)
    legacy_profile = legacy.get("profile", {}) if isinstance(legacy, dict) else {}
    if str(legacy_profile.get("employeeId") or "").strip() == user_id:
        set_state(session, employee_journey_state_key(user_id), legacy)
        return legacy

    return deepcopy(DEFAULT_EMPLOYEE_JOURNEY)


def set_employee_journey_for_user(session, user_id: str, journey: dict[str, Any]) -> dict[str, Any]:
    set_state(session, employee_journey_state_key(user_id), journey)
    return journey


def parse_iso_datetime(value: Any) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    normalized = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def normalize_phone_number(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return ""
    return digits


def normalize_whatsapp_phone(phone_number: Any, country_code: Any = "") -> str:
    raw_phone = str(phone_number or "").strip()
    raw_country_code = str(country_code or "").strip()
    explicit_country = raw_phone.startswith("+") or raw_phone.startswith("00")
    phone_digits = normalize_phone_number(raw_phone)
    country_digits = normalize_phone_number(raw_country_code)

    if raw_phone.startswith("00") and phone_digits.startswith("00"):
        phone_digits = phone_digits[2:]

    if explicit_country:
        return phone_digits
    if country_digits:
        if phone_digits.startswith(country_digits):
            return phone_digits
        return f"{country_digits}{phone_digits}"
    return phone_digits


def validate_whatsapp_phone(phone_number: Any, country_code: Any = "") -> tuple[str, str]:
    raw_phone = str(phone_number or "").strip()
    normalized_phone = normalize_whatsapp_phone(raw_phone, country_code)
    has_country_code = bool(str(country_code or "").strip()) or raw_phone.startswith("+") or raw_phone.startswith("00")

    if not normalized_phone:
        raise HTTPException(status_code=400, detail="A WhatsApp number is required")
    if len(normalized_phone) < 8 or len(normalized_phone) > 15:
        raise HTTPException(status_code=400, detail="Enter a valid WhatsApp number with country code")
    if not has_country_code and len(normalize_phone_number(raw_phone)) <= 10:
        raise HTTPException(status_code=400, detail="Include the WhatsApp country code, for example +1 or +91")

    display_number = f"+{normalized_phone}"
    return normalized_phone, display_number


def build_whatsapp_link(phone_number: str, message: str, country_code: str = "") -> str:
    encoded_message = urllib.parse.quote(str(message or "").strip(), safe="")
    normalized_phone = normalize_whatsapp_phone(phone_number, country_code)
    if normalized_phone:
        return (
            "https://api.whatsapp.com/send/?"
            f"phone={normalized_phone}&text={encoded_message}&type=phone_number&app_absent=0"
        )
    return f"https://api.whatsapp.com/send/?text={encoded_message}&type=phone_number&app_absent=0"


def format_calendar_datetime(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def escape_ics_text(value: Any) -> str:
    text = str(value or "")
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def build_google_calendar_link(entry: dict[str, Any]) -> str:
    start_at = parse_iso_datetime(entry.get("startAt"))
    end_at = parse_iso_datetime(entry.get("endAt"))
    if not start_at or not end_at:
        return ""
    params = {
        "action": "TEMPLATE",
        "text": str(entry.get("title") or "Interview"),
        "dates": f"{format_calendar_datetime(start_at)}/{format_calendar_datetime(end_at)}",
        "details": str(entry.get("notes") or ""),
        "location": str(entry.get("location") or ""),
    }
    return f"https://calendar.google.com/calendar/render?{urllib.parse.urlencode(params)}"


def build_schedule_ics(entry: dict[str, Any]) -> str:
    start_at = parse_iso_datetime(entry.get("startAt")) or datetime.now(UTC)
    end_at = parse_iso_datetime(entry.get("endAt")) or (start_at + timedelta(minutes=int(entry.get("durationMinutes") or 45)))
    created_at = parse_iso_datetime(entry.get("createdAt")) or datetime.now(UTC)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SkillSenseAI//Manager Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{entry.get('id', uuid4().hex)}@skillsenseai.local",
        f"DTSTAMP:{format_calendar_datetime(created_at)}",
        f"DTSTART:{format_calendar_datetime(start_at)}",
        f"DTEND:{format_calendar_datetime(end_at)}",
        f"SUMMARY:{escape_ics_text(entry.get('title') or 'Interview')}",
        f"DESCRIPTION:{escape_ics_text(entry.get('notes') or '')}",
        f"LOCATION:{escape_ics_text(entry.get('location') or '')}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(lines) + "\r\n"


def serialize_manager_schedule_record(record: ManagerInterviewScheduleRecord) -> dict[str, Any]:
    payload = {
        "id": record.id,
        "employeeId": record.employee_id,
        "candidateName": record.candidate_name,
        "role": record.role,
        "managerId": record.manager_id,
        "managerName": record.manager_name,
        "title": record.title,
        "meetingMode": record.meeting_mode,
        "location": record.location,
        "notes": record.notes,
        "startAt": record.start_at,
        "endAt": record.end_at,
        "durationMinutes": record.duration_minutes,
        "status": record.status,
        "createdAt": record.created_at,
    }
    payload["googleCalendarUrl"] = build_google_calendar_link(payload)
    return payload


def get_manager_interview_schedules(session) -> list[dict[str, Any]]:
    rows = session.scalars(select(ManagerInterviewScheduleRecord).order_by(ManagerInterviewScheduleRecord.created_at.desc())).all()
    return [serialize_manager_schedule_record(row) for row in rows]


def serialize_manager_communication_record(record: ManagerCommunicationRecord) -> dict[str, Any]:
    return {
        "id": record.id,
        "employeeId": record.employee_id,
        "candidateName": record.candidate_name,
        "channel": record.channel,
        "subject": record.subject,
        "message": record.message,
        "recipient": record.recipient,
        "recipientPhone": record.recipient_phone,
        "deliveryStatus": record.delivery_status,
        "launchUrl": record.launch_url,
        "sentBy": record.sent_by,
        "createdAt": record.created_at,
    }


def get_manager_communication_history(session) -> list[dict[str, Any]]:
    rows = session.scalars(select(ManagerCommunicationRecord).order_by(ManagerCommunicationRecord.created_at.desc())).all()
    return [serialize_manager_communication_record(row) for row in rows]


def append_manager_communication(session, payload: dict[str, Any]) -> dict[str, Any]:
    record = ManagerCommunicationRecord(
        id=str(payload.get("id") or f"comm-{uuid4().hex[:10]}"),
        employee_id=str(payload.get("employeeId") or "").strip(),
        candidate_name=str(payload.get("candidateName") or "").strip(),
        channel=str(payload.get("channel") or "").strip(),
        subject=str(payload.get("subject") or "").strip(),
        message=str(payload.get("message") or "").strip(),
        recipient=str(payload.get("recipient") or "").strip(),
        recipient_phone=str(payload.get("recipientPhone") or "").strip(),
        delivery_status=str(payload.get("deliveryStatus") or "recorded").strip(),
        launch_url=str(payload.get("launchUrl") or "").strip(),
        sent_by=str(payload.get("sentBy") or "").strip(),
        created_at=str(payload.get("createdAt") or datetime.now(UTC).isoformat()).strip(),
    )
    session.add(record)
    return serialize_manager_communication_record(record)


def serialize_manager_schedule(entry: dict[str, Any]) -> dict[str, Any]:
    payload = dict(entry)
    payload["googleCalendarUrl"] = build_google_calendar_link(entry)
    return payload


def score_tone(value: float, *, max_score: float) -> str:
    ratio = value / max(max_score, 1)
    if ratio >= 0.75:
        return "strong"
    if ratio >= 0.55:
        return "steady"
    return "watch"


def build_candidate_recommendation(match_score: float, interview_score: float, confidence: str) -> str:
    if match_score >= 80 and interview_score >= 4.1:
        return "Advance to final round"
    if match_score >= 65 and interview_score >= 3.4:
        return "Keep in active shortlist"
    if confidence.lower() == "low":
        return "Collect more evidence before decision"
    return "Needs targeted follow-up"


def build_candidate_headline(name: str, role: str, match_score: float, interview_score: float, fit_label: str) -> str:
    role_text = role or "the target role"
    if match_score >= 80 and interview_score >= 4.1:
        return f"{name} looks ready for {role_text} with strong job-match coverage and interview proof."
    if match_score >= 65 or interview_score >= 3.4:
        return f"{name} is a credible contender for {role_text}, but the decision still depends on validating a few gaps."
    return f"{name} is not an obvious fit for {role_text} yet, so manager follow-up should focus on proof instead of potential."


def build_candidate_why_this_candidate(
    *,
    name: str,
    role: str,
    resume_analysis: dict[str, Any],
    job_match: dict[str, Any],
    latest_assessment: dict[str, Any],
) -> dict[str, Any]:
    interview_score = float(latest_assessment.get("score") or 0)
    match_score = float(job_match.get("score") or 0)
    confidence = str(latest_assessment.get("confidence") or "Medium")
    fit_label = str(job_match.get("fitLabel") or "Potential Match")

    fit_reasons: list[str] = []
    if job_match.get("matchedSkills"):
        fit_reasons.append(f"Resume-to-JD overlap already covers {', '.join(job_match.get('matchedSkills', [])[:4])}.")
    if latest_assessment.get("strengths"):
        fit_reasons.append(f"Interview strengths point to {', '.join(latest_assessment.get('strengths', [])[:3])}.")
    if resume_analysis.get("experience"):
        experience = resume_analysis.get("experience", [])
        first = experience[0] if isinstance(experience, list) and experience else {}
        if isinstance(first, dict) and (first.get("title") or first.get("company")):
            fit_reasons.append(
                f"Recent experience includes {str(first.get('title') or 'a relevant role')} {('at ' + str(first.get('company'))) if first.get('company') else ''}.".strip()
            )

    interview_evidence: list[str] = []
    for item in latest_assessment.get("perDomain", []) if isinstance(latest_assessment.get("perDomain"), list) else []:
        try:
            domain_score = float(item.get("score") or 0)
        except (TypeError, ValueError):
            domain_score = 0
        if domain_score >= 4:
            interview_evidence.append(f"{item.get('title')}: scored {domain_score:.1f}/5 during the interview.")
    if latest_assessment.get("summary"):
        interview_evidence.append(str(latest_assessment.get("summary")))

    concerns: list[str] = []
    if job_match.get("missingSkills"):
        concerns.append(f"Missing or weak evidence for {', '.join(job_match.get('missingSkills', [])[:4])}.")
    if latest_assessment.get("gaps"):
        concerns.append(f"Interview gaps still include {', '.join(latest_assessment.get('gaps', [])[:3])}.")
    warnings = resume_analysis.get("warnings", []) if isinstance(resume_analysis.get("warnings"), list) else []
    if warnings:
        concerns.append(str(warnings[0]))
    if not concerns:
        concerns.append("No major red flags surfaced, but reference checks and role-specific follow-ups are still recommended.")

    next_steps: list[str] = []
    next_steps.extend(job_match.get("interviewFocus", [])[:2] if isinstance(job_match.get("interviewFocus"), list) else [])
    next_steps.extend(job_match.get("recommendedActions", [])[:2] if isinstance(job_match.get("recommendedActions"), list) else [])
    for item in latest_assessment.get("recommendations", []) if isinstance(latest_assessment.get("recommendations"), list) else []:
        label = item.get("title") if isinstance(item, dict) else str(item)
        if label:
            next_steps.append(str(label))
    next_steps = list(dict.fromkeys(next_steps))[:4] or ["Schedule one targeted follow-up round to validate role-critical gaps."]

    return {
        "headline": build_candidate_headline(name, role, match_score, interview_score, fit_label),
        "recommendation": build_candidate_recommendation(match_score, interview_score, confidence),
        "fitReasons": fit_reasons[:3] or ["Resume and interview signals are still developing, so this candidate needs more structured evidence."],
        "interviewEvidence": interview_evidence[:4] or ["No interview evidence captured yet."],
        "concerns": concerns[:4],
        "nextSteps": next_steps,
        "sourceSignals": [
            {"label": "JD Match", "value": f"{int(round(match_score))}%", "tone": score_tone(match_score, max_score=100)},
            {"label": "Interview", "value": f"{interview_score:.1f}/5" if interview_score else "Pending", "tone": score_tone(interview_score, max_score=5)},
            {"label": "Confidence", "value": confidence, "tone": "steady" if confidence.lower() == "medium" else ("strong" if confidence.lower() == "high" else "watch")},
            {"label": "Fit", "value": fit_label, "tone": "strong" if "strong" in fit_label.lower() else ("steady" if "promising" in fit_label.lower() else "watch")},
        ],
    }


def build_candidate_message_templates(candidate: dict[str, Any]) -> dict[str, str]:
    candidate_name = str(candidate.get("candidateName") or "there").strip()
    role = str(candidate.get("role") or "the role").strip()
    recommendation = str((candidate.get("whyThisCandidate") or {}).get("recommendation") or "Keep in active shortlist")
    schedule_title = str(candidate.get("scheduleTemplateTitle") or f"{role} interview").strip()
    return {
        "emailSubject": f"Next step for your {role} application",
        "emailBody": "\n".join(
            [
                f"Hi {candidate_name},",
                "",
                f"We've reviewed your profile for the {role} opportunity and would like to move you forward.",
                f"Current manager recommendation: {recommendation}.",
                "",
                f"Our next suggested step is a {schedule_title}. Reply with your availability and we will confirm the slot.",
                "",
                "Regards,",
                "Hiring Team",
            ]
        ),
        "whatsappBody": f"Hi {candidate_name}, we reviewed your profile for the {role} role and would like to move to the next step. Please share your availability for a follow-up interview.",
    }


def trim_sentence(text: str) -> str:
    cleaned = " ".join(str(text or "").split()).strip()
    return cleaned.rstrip(" .,!?:;")


def ensure_sentence(text: str) -> str:
    cleaned = trim_sentence(text)
    if not cleaned:
        return ""
    return f"{cleaned}."


def sentence_case(text: str) -> str:
    cleaned = trim_sentence(text)
    if not cleaned:
        return ""
    segments = [segment.strip() for segment in cleaned.replace("!", ".").replace("?", ".").split(".") if segment.strip()]
    normalized = []
    for segment in segments:
        normalized.append(segment[:1].upper() + segment[1:])
    return ". ".join(normalized)


def summarize_next_step(next_steps: list[str]) -> str:
    if not next_steps:
        return "a short follow-up discussion"
    first = trim_sentence(next_steps[0])
    if not first:
        return "a short follow-up discussion"
    return first[:100]


def heuristic_enhance_manager_message(
    *,
    channel: str,
    candidate_name: str,
    role: str,
    recommendation: str,
    message: str,
    subject: str,
    next_steps: list[str],
) -> dict[str, str]:
    cleaned_message = " ".join(str(message or "").split()).strip()
    cleaned_subject = " ".join(str(subject or "").split()).strip()
    role_text = role or "the role"
    recommendation_text = recommendation or "the next step"
    next_step_text = summarize_next_step(next_steps)

    if channel == "whatsapp":
        core = trim_sentence(cleaned_message)
        if core.lower().startswith("hi "):
            core = core.split(",", 1)[1].strip() if "," in core else " ".join(core.split()[2:]).strip()
        if not core:
            core = f"we reviewed your profile for the {role_text} role and would like to move you forward"
        core_sentence = ensure_sentence(sentence_case(core))
        ask_sentence = "" if "availability" in core.lower() else f"Please share your availability for {next_step_text}."
        enhanced_message = " ".join(part for part in [f"Hi {candidate_name},", core_sentence, ask_sentence] if part).strip()
        words = enhanced_message.split()
        if len(words) > 70:
            enhanced_message = " ".join(words[:70]).rstrip(" .,") + "."
        return {"subject": "", "message": enhanced_message}

    if not cleaned_subject:
        cleaned_subject = f"Next step for your {role_text} application"
    body_core = trim_sentence(cleaned_message)
    if body_core.lower().startswith("hi "):
        parts = body_core.split(",", 1)
        body_core = parts[1].strip() if len(parts) > 1 else " ".join(body_core.split()[2:]).strip()
    if not body_core:
        body_core = f"We reviewed your profile for the {role_text} role and would like to move forward with {recommendation_text.lower()}"
    ask_sentence = "" if "availability" in body_core.lower() else f"Please share your availability for {next_step_text}."
    cleaned_message = "\n".join(
        [
            f"Hi {candidate_name},",
            "",
            ensure_sentence(sentence_case(body_core)),
            ask_sentence,
            "",
            "Regards,",
            "Hiring Team",
        ]
    ).strip()
    return {"subject": cleaned_subject, "message": cleaned_message}


def enhance_manager_message_with_ai(
    *,
    channel: str,
    candidate_name: str,
    role: str,
    recommendation: str,
    message: str,
    subject: str,
    fit_reasons: list[str],
    next_steps: list[str],
) -> dict[str, str]:
    fallback = heuristic_enhance_manager_message(
        channel=channel,
        candidate_name=candidate_name,
        role=role,
        recommendation=recommendation,
        message=message,
        subject=subject,
        next_steps=next_steps,
    )

    instruction = (
        "You are a recruiting communications assistant. Rewrite the manager's outreach so it sounds warm, clear, and professional. "
        "Preserve the intent, candidate name, and next-step ask. "
        "For WhatsApp: one paragraph, concise, under 80 words, no markdown. "
        "For email: keep the subject concise and the body readable. "
        "Return a single JSON object only with keys subject and message."
    )
    prompt = json.dumps(
        {
            "channel": channel,
            "candidateName": candidate_name,
            "role": role,
            "recommendation": recommendation,
            "currentSubject": subject,
            "currentMessage": message,
            "fitReasons": fit_reasons[:3],
            "nextSteps": next_steps[:3],
            "fallback": fallback,
        },
        ensure_ascii=True,
    )

    response_text = generate_gemini_text(
        system_instruction=instruction,
        user_prompt=prompt,
        temperature=0.3,
        max_output_tokens=280,
    )
    parsed = extract_json_object(response_text or "")
    if parsed:
        enhanced_subject = str(parsed.get("subject") or fallback["subject"]).strip()
        enhanced_message = str(parsed.get("message") or fallback["message"]).strip()
        if enhanced_message:
            return {"subject": enhanced_subject, "message": enhanced_message, "provider": "gemini"}

    client = get_openai_client()
    if client is not None:
        try:
            response = client.responses.create(
                model=OPENAI_MODEL,
                input=[
                    {"role": "system", "content": instruction},
                    {"role": "user", "content": prompt},
                ],
                max_output_tokens=220,
                temperature=0.3,
            )
            parsed = extract_json_object((getattr(response, "output_text", "") or "").strip())
            if parsed:
                enhanced_subject = str(parsed.get("subject") or fallback["subject"]).strip()
                enhanced_message = str(parsed.get("message") or fallback["message"]).strip()
                if enhanced_message:
                    return {"subject": enhanced_subject, "message": enhanced_message, "provider": "openai"}
        except Exception:
            pass

    return {**fallback, "provider": "builtin"}


def build_manager_candidate_workbench(session) -> dict[str, Any]:
    employees = session.scalars(select(UserRecord).where(UserRecord.role == "employee").order_by(UserRecord.full_name)).all()
    if not employees:
        return {
            "generatedAt": datetime.now(UTC).isoformat(),
            "storage": {
                "databaseMode": get_database_mode(),
                "isRemoteDatabase": get_database_mode() == "remote",
                "persistence": "sql_tables",
            },
            "summary": {
                "totalCandidates": 0,
                "interviewReady": 0,
                "strongMatches": 0,
                "scheduled": 0,
            },
            "candidates": [],
        }

    employee_ids = [item.id for item in employees]
    journey_keys = [employee_journey_state_key(employee_id) for employee_id in employee_ids]
    settings_keys = [user_settings_state_key(employee_id) for employee_id in employee_ids]
    state_rows = session.scalars(select(AppStateRecord).where(AppStateRecord.state_key.in_(["employeeJourney", *journey_keys, *settings_keys]))).all()
    state_payload: dict[str, Any] = {row.state_key: loads_json(row.payload, {}) for row in state_rows}

    legacy_journey = state_payload.get("employeeJourney", DEFAULT_EMPLOYEE_JOURNEY)
    legacy_profile = legacy_journey.get("profile", {}) if isinstance(legacy_journey, dict) else {}
    legacy_employee_id = str(legacy_profile.get("employeeId") or "").strip()

    schedule_rows = session.scalars(
        select(ManagerInterviewScheduleRecord)
        .where(ManagerInterviewScheduleRecord.employee_id.in_(employee_ids))
        .order_by(ManagerInterviewScheduleRecord.created_at.desc())
    ).all()
    schedules_by_employee: dict[str, list[dict[str, Any]]] = {}
    for row in schedule_rows:
        schedules_by_employee.setdefault(str(row.employee_id or ""), []).append(serialize_manager_schedule_record(row))

    communication_rows = session.scalars(
        select(ManagerCommunicationRecord)
        .where(ManagerCommunicationRecord.employee_id.in_(employee_ids))
        .order_by(ManagerCommunicationRecord.created_at.desc())
    ).all()
    communications_by_employee: dict[str, list[dict[str, Any]]] = {}
    for row in communication_rows:
        payload = serialize_manager_communication_record(row)
        employee_id = str(payload.get("employeeId") or "")
        bucket = communications_by_employee.setdefault(employee_id, [])
        if len(bucket) < 8:
            bucket.append(payload)

    assessment_rows = session.execute(
        select(
            AssessmentRecord.id,
            AssessmentRecord.title,
            AssessmentRecord.employee,
            AssessmentRecord.employee_id,
            AssessmentRecord.status,
            AssessmentRecord.score,
            AssessmentRecord.date,
            AssessmentRecord.duration,
            AssessmentRecord.interviewer,
            AssessmentRecord.focus_area,
            AssessmentRecord.summary,
            AssessmentRecord.per_domain_json,
            AssessmentRecord.profile_json,
            AssessmentRecord.strengths_json,
            AssessmentRecord.gaps_json,
            AssessmentRecord.recommendations_json,
            AssessmentRecord.hiring_signal,
            AssessmentRecord.confidence,
            AssessmentRecord.evaluation_method,
        ).where(AssessmentRecord.employee_id.in_(employee_ids))
    ).all()
    latest_assessment_by_employee: dict[str, dict[str, Any]] = {}
    latest_assessment_sort_keys: dict[str, tuple[float, str]] = {}
    for row in assessment_rows:
        employee_id = str(row.employee_id or "").strip()
        if not employee_id:
            continue
        date_value = str(row.date or "").strip()
        parsed = parse_iso_datetime(date_value)
        sort_key = (parsed.timestamp() if parsed else 0.0, date_value)
        previous_key = latest_assessment_sort_keys.get(employee_id)
        if previous_key is not None and sort_key <= previous_key:
            continue
        latest_assessment_sort_keys[employee_id] = sort_key
        latest_assessment_by_employee[employee_id] = {
            "id": row.id,
            "title": row.title,
            "employee": row.employee,
            "employeeId": employee_id,
            "status": row.status,
            "score": float(row.score or 0),
            "date": date_value,
            "duration": row.duration,
            "interviewer": row.interviewer,
            "focusArea": row.focus_area,
            "summary": row.summary,
            "perDomain": loads_json(row.per_domain_json, []),
            "profile": loads_json(row.profile_json, {}),
            "strengths": loads_json(row.strengths_json, []),
            "gaps": loads_json(row.gaps_json, []),
            "recommendations": loads_json(row.recommendations_json, []),
            "hiringSignal": row.hiring_signal,
            "confidence": row.confidence,
            "evaluationMethod": row.evaluation_method,
        }

    rows: list[dict[str, Any]] = []
    for employee in employees:
        journey = state_payload.get(employee_journey_state_key(employee.id), {})
        if not isinstance(journey, dict) or not journey:
            if isinstance(legacy_journey, dict) and legacy_employee_id == employee.id:
                journey = legacy_journey
            else:
                journey = deepcopy(DEFAULT_EMPLOYEE_JOURNEY)
        profile = journey.get("profile", {}) if isinstance(journey.get("profile"), dict) else {}
        resume = journey.get("resume", {}) if isinstance(journey.get("resume"), dict) else {}
        resume_analysis = journey.get("resumeAnalysis", {}) if isinstance(journey.get("resumeAnalysis"), dict) else {}
        job_match = journey.get("jobMatchAnalysis", {}) if isinstance(journey.get("jobMatchAnalysis"), dict) else {}
        assessment = latest_assessment_by_employee.get(employee.id, {})
        assessment_profile = assessment.get("profile", {}) if isinstance(assessment.get("profile"), dict) else {}
        employee_settings = build_settings_payload_for_user(employee, state_payload.get(user_settings_state_key(employee.id), {}))
        settings_profile = employee_settings.get("profile", {}) if isinstance(employee_settings.get("profile"), dict) else {}

        candidate_name = str(profile.get("fullName") or employee.full_name or assessment.get("employee") or "Candidate").strip()
        role = str(profile.get("role") or assessment_profile.get("role") or "").strip()
        department = str(profile.get("department") or employee.department or "").strip()
        contact_email = str(profile.get("email") or settings_profile.get("email") or employee.email or "").strip()
        contact_phone = str(profile.get("phone") or settings_profile.get("phone") or assessment_profile.get("phone") or "").strip()
        match_score = float(job_match.get("score") or 0)
        interview_score = float(assessment.get("score") or 0)

        row = {
            "employeeId": employee.id,
            "candidateName": candidate_name,
            "role": role,
            "department": department,
            "profile": profile,
            "contact": {
                "email": contact_email,
                "phone": contact_phone,
                "location": str(profile.get("location") or assessment_profile.get("location") or "").strip(),
            },
            "resume": {
                "fileName": str(resume.get("fileName") or "").strip(),
                "uploadedAt": str(resume.get("uploadedAt") or "").strip(),
                "analysisStatus": str(journey.get("resumeAnalysisStatus") or "").strip(),
                "summary": str(resume_analysis.get("summary") or "").strip(),
                "skills": resume_analysis.get("skills", []) if isinstance(resume_analysis.get("skills"), list) else [],
                "experience": resume_analysis.get("experience", []) if isinstance(resume_analysis.get("experience"), list) else [],
                "education": resume_analysis.get("education", []) if isinstance(resume_analysis.get("education"), list) else [],
                "source": str(resume_analysis.get("source") or "").strip(),
                "qualityGrade": str(resume_analysis.get("qualityGrade") or "").strip(),
                "warnings": resume_analysis.get("warnings", []) if isinstance(resume_analysis.get("warnings"), list) else [],
            },
            "jobMatch": job_match,
            "interview": assessment,
            "whyThisCandidate": build_candidate_why_this_candidate(
                name=candidate_name,
                role=role,
                resume_analysis=resume_analysis,
                job_match=job_match,
                latest_assessment=assessment,
            ),
            "schedules": schedules_by_employee.get(employee.id, []),
            "communications": communications_by_employee.get(employee.id, []),
            "scheduleTemplateTitle": f"{role or 'Role'} manager interview",
        }
        row["templates"] = build_candidate_message_templates(row)
        rows.append(row)

    rows.sort(
        key=lambda item: (
            -float(((item.get("jobMatch") or {}).get("score") or 0)),
            -float(((item.get("interview") or {}).get("score") or 0)),
            str(item.get("candidateName") or "").lower(),
        )
    )
    return {
        "generatedAt": datetime.now(UTC).isoformat(),
        "storage": {
            "databaseMode": get_database_mode(),
            "isRemoteDatabase": get_database_mode() == "remote",
            "persistence": "sql_tables",
        },
        "summary": {
            "totalCandidates": len(rows),
            "interviewReady": sum(1 for item in rows if (item.get("interview") or {}).get("id")),
            "strongMatches": sum(1 for item in rows if float(((item.get("jobMatch") or {}).get("score") or 0)) >= 80),
            "scheduled": sum(1 for item in rows for schedule in item.get("schedules", []) if str(schedule.get("status") or "") == "scheduled"),
        },
        "candidates": rows,
    }


app = FastAPI(title="SkillSenseAI API", version="2.0.0")
raw_origins = os.getenv(
    "CORS_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5175,http://localhost:5175",
)
cors_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
cors_origins = [origin for origin in cors_origins if origin != "*"]
if not cors_origins:
    cors_origins = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5175",
        "http://localhost:5175",
    ]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def attach_session_cookie(request, call_next):
    REQUEST_SESSION_TOKEN.set(request.cookies.get(SESSION_COOKIE_NAME))
    response = await call_next(request)
    return response


@app.on_event("startup")
def startup_event() -> None:
    init_database()
    with db_session() as session:
        users = session.scalars(select(UserRecord).where(UserRecord.role == "employee")).all()
        for user in users:
            current_name = str(user.full_name or "").strip().lower()
            if not current_name or current_name == "employee account":
                user.full_name = derive_name_from_email(user.email)
        employees_payload = [serialize_employee(item) for item in session.scalars(select(EmployeeRecord).order_by(EmployeeRecord.id)).all()]
        cache_set("employees:list", employees_payload)
        roles_payload = [
            serialize_role(item, build_role_members(item.name, employees_payload))
            for item in session.scalars(select(RoleRecord).order_by(RoleRecord.id)).all()
        ]
        cache_set("roles:list", roles_payload)
        cache_set("dashboard:summary", build_dynamic_dashboard(session))


@app.get("/")
def root() -> dict[str, Any]:
    return {"message": "SkillSenseAI FastAPI backend is running", "database": get_database_mode(), "health": "/api/health", "docs": "/docs"}


@app.get("/api")
def api_root() -> dict[str, Any]:
    return {"message": "SkillSenseAI API", "database": get_database_mode(), "health": "/api/health"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "database": get_database_mode()}


@app.post("/api/auth/manager/login")
def manager_login(payload: dict[str, Any], response: Response) -> dict[str, Any]:
    require_human_verification(payload)
    with db_session() as session:
        security = get_security_settings(session)
        user = session.scalar(select(UserRecord).where(UserRecord.email == payload.get("email"), UserRecord.role == "manager"))
        if not user or user.password_hash != hash_password(str(payload.get("password", ""))):
            raise HTTPException(status_code=401, detail="Invalid manager credentials")
        totp = totp_status(session, user.id)
        if security.get("twoFactorRequired", True) and totp.get("enabled"):
            code = str(payload.get("code", "")).strip()
            if not code:
                return {"requiresTwoFactor": True, "twoFactorEnabled": True}
            if not verify_totp_code(get_state(session, f"totp:{user.id}", {}).get("secret", ""), code):
                raise HTTPException(status_code=401, detail="Invalid two-factor code")
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="manager_login",
            target="auth",
            meta={"email": user.email},
        )
        return issue_session_response(user, response)


@app.post("/api/auth/employee/login")
def employee_login(payload: dict[str, Any], response: Response) -> dict[str, Any]:
    require_human_verification(payload)
    with db_session() as session:
        security = get_security_settings(session)
        raw_email = str(payload.get("email", "")).strip()
        email = raw_email.lower()
        employee_id = str(payload.get("employeeId", "")).strip()
        password_value = str(payload.get("password", "")).strip()

        user = None
        if email:
            user = session.scalar(
                select(UserRecord).where(
                    UserRecord.role == "employee",
                    func.lower(UserRecord.email) == email,
                )
            )
            if user and employee_id and str(user.id).lower() != employee_id.lower():
                raise HTTPException(
                    status_code=401,
                    detail=f"Employee ID does not match this email. Use {user.id}",
                )
        if not user and employee_id:
            user = session.scalar(
                select(UserRecord).where(
                    UserRecord.role == "employee",
                    func.lower(UserRecord.id) == employee_id.lower(),
                )
            )

        if not user or user.password_hash != hash_password(password_value):
            raise HTTPException(status_code=401, detail="Invalid employee credentials")
        journey = get_employee_journey_for_user(session, user.id)
        journey_profile = journey.get("profile", {})
        profile_name = str(journey_profile.get("fullName") or "").strip()
        if journey_profile.get("employeeId") == user.id and profile_name:
            user.full_name = profile_name
        elif not str(user.full_name or "").strip() or str(user.full_name).strip().lower() == "employee account":
            user.full_name = derive_name_from_email(user.email)
        totp = totp_status(session, user.id)
        if security.get("twoFactorRequired", True) and totp.get("enabled"):
            code = str(payload.get("code", "")).strip()
            if not code:
                return {"requiresTwoFactor": True, "twoFactorEnabled": True}
            if not verify_totp_code(get_state(session, f"totp:{user.id}", {}).get("secret", ""), code):
                raise HTTPException(status_code=401, detail="Invalid two-factor code")
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="employee_login",
            target="auth",
            meta={"email": user.email},
        )
        return issue_session_response(user, response)


@app.post("/api/auth/employee/register")
def employee_register(payload: dict[str, Any], response: Response) -> dict[str, Any]:
    require_human_verification(payload)
    with db_session() as session:
        security = get_security_settings(session)
        existing = session.scalar(select(UserRecord).where(UserRecord.email == payload.get("email")))
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")
        user = UserRecord(id=payload["employeeId"], email=payload["email"], role="employee", full_name=payload["fullName"], department=payload["department"], password_hash=hash_password(str(payload["password"])))
        session.add(user)
        session.flush()
        if security.get("twoFactorRequired", True):
            return issue_two_factor_challenge(user)
        return issue_session_response(user, response)


@app.post("/api/auth/2fa/verify")
def verify_two_factor(payload: dict[str, Any]) -> dict[str, Any]:
    # Legacy endpoint kept for compatibility; now delegates to TOTP verification if a secret exists.
    code = str(payload.get("code") or "").strip()
    user_id = str(payload.get("userId") or "")
    if not code or not user_id:
        raise HTTPException(status_code=400, detail="Two-factor code and user are required")
    with db_session() as session:
        user = session.get(UserRecord, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User account no longer exists")
        totp = get_state(session, f"totp:{user.id}", {})
        secret = totp.get("secret", "")
        if not secret or not verify_totp_code(secret, code):
            raise HTTPException(status_code=401, detail="Invalid two-factor code")
        return build_session(user)


@app.get("/api/auth/2fa/status")
def two_factor_status(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        return totp_status(session, user.id)


@app.post("/api/auth/2fa/setup")
def two_factor_setup(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        current = get_state(session, f"totp:{user.id}", {"enabled": False, "secret": ""})
        secret = current.get("secret") or generate_totp_secret()
        enabled = bool(current.get("enabled"))
        state = set_totp_state(session, user.id, secret, enabled)

    otpauth_url = f"otpauth://totp/SkillSenseAI:{user.email}?secret={secret}&issuer=SkillSenseAI"
    qr_code_url = f"https://api.qrserver.com/v1/create-qr-code/?size=240x240&data={otpauth_url}"
    return {"secret": secret, "otpauthUrl": otpauth_url, "qrCodeUrl": qr_code_url, **state}


@app.post("/api/auth/2fa/enable")
def two_factor_enable(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    code = str(payload.get("code") or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Verification code is required")
    with db_session() as session:
        state = get_state(session, f"totp:{user.id}", {"secret": "", "enabled": False})
        secret = state.get("secret", "")
        if not secret:
            raise HTTPException(status_code=400, detail="Start two-factor setup first")
        if not verify_totp_code(secret, code):
            raise HTTPException(status_code=401, detail="Invalid two-factor code")
        updated = set_totp_state(session, user.id, secret, True)
    return updated


@app.post("/api/auth/2fa/disable")
def two_factor_disable(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        updated = set_totp_state(session, user.id, "", False)
    return updated


@app.get("/api/auth/me")
def auth_me(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return serialize_user(user)


@app.post("/api/auth/logout")
def logout(response: Response, authorization: str | None = Header(default=None)) -> dict[str, bool]:
    token = get_current_token(authorization)
    if token:
        ACTIVE_SESSIONS.pop(token, None)
    response.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return {"success": True}


@app.post("/api/auth/password")
def change_password(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    current_password = str(payload.get("currentPassword", ""))
    new_password = str(payload.get("newPassword", ""))
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long")

    with db_session() as session:
        user_record = session.get(UserRecord, user.id)
        if not user_record or user_record.password_hash != hash_password(current_password):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        user_record.password_hash = hash_password(new_password)

        security_row = session.get(SettingsRecord, "security")
        security_payload = get_security_settings(session)
        security_payload["lastPasswordChange"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        if security_row:
            security_row.payload = dumps_json(security_payload)
        else:
            session.add(SettingsRecord(section="security", payload=dumps_json(security_payload)))

    return {"success": True, "lastPasswordChange": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}


@app.get("/api/auth/sessions")
def list_sessions(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    current_token = get_current_token(authorization)
    if not user or not current_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    cleanup_active_sessions()
    rows = []
    for token, details in ACTIVE_SESSIONS.items():
        if details.get("userId") == user.id:
            rows.append(
                {
                    "id": token,
                    "device": details.get("device", "Web browser"),
                    "createdAt": details.get("createdAt", ""),
                    "current": token == current_token,
                }
            )
    return rows


@app.post("/api/auth/sessions/revoke-others")
def revoke_other_sessions(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    current_token = get_current_token(authorization)
    if not user or not current_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    removed = 0
    for token, details in list(ACTIVE_SESSIONS.items()):
        if details.get("userId") == user.id and token != current_token:
            ACTIVE_SESSIONS.pop(token, None)
            removed += 1
    return {"success": True, "revokedSessions": removed}


@app.delete("/api/auth/account")
def delete_account(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user_from_token = resolve_user_from_auth(authorization)
    if not user_from_token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user_id = user_from_token.id
    with db_session() as session:
        user = session.get(UserRecord, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Account not found")
        session.delete(user)
        for item in session.scalars(select(AssessmentRecord).where(AssessmentRecord.employee_id == user_id)).all():
            session.delete(item)
        journey = get_state(session, "employeeJourney", DEFAULT_EMPLOYEE_JOURNEY)
        if journey.get("profile", {}).get("employeeId") == user_id:
            set_state(session, "employeeJourney", DEFAULT_EMPLOYEE_JOURNEY)
        for token, details in list(ACTIVE_SESSIONS.items()):
            if details.get("userId") == user_id:
                ACTIVE_SESSIONS.pop(token, None)
        set_state(session, user_settings_state_key(user_id), {})
        set_state(session, f"totp:{user_id}", {"enabled": False, "secret": ""})
        append_audit_log(
            session,
            actor_id=user_id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="delete_account",
            target="auth",
            meta={"email": user.email},
        )
        return {"success": True, "deletedUserId": user_id}


@app.get("/api/notifications")
def get_notifications(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    cache_key = f"notifications:list:{user.id}"
    cached = cache_get(cache_key, ttl_seconds=3)
    if cached is not None:
        return cached
    with db_session() as session:
        rows = session.scalars(
            select(NotificationRecord)
            .where(NotificationRecord.user_id == user.id)
            .order_by(NotificationRecord.id.desc())
            .limit(100)
        ).all()
        payload = [serialize_notification(item) for item in rows]
        cache_set(cache_key, payload)
        return payload


@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        item = session.get(NotificationRecord, notification_id)
        if not item or item.user_id != user.id:
            raise HTTPException(status_code=404, detail="Notification not found")
        item.is_read = True
        rows = session.scalars(
            select(NotificationRecord)
            .where(NotificationRecord.user_id == user.id)
            .order_by(NotificationRecord.id.desc())
            .limit(100)
        ).all()
        payload = [serialize_notification(row) for row in rows]
        cache_set(f"notifications:list:{user.id}", payload)
        return payload


@app.get("/api/settings")
def get_settings(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        user_record = session.get(UserRecord, user.id)
        if not user_record:
            raise HTTPException(status_code=401, detail="Unauthorized")
        return get_settings_for_user(session, user_record)


@app.put("/api/settings/{section}")
def update_settings(section: str, payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        user_record = session.get(UserRecord, user.id)
        if not user_record:
            raise HTTPException(status_code=401, detail="Unauthorized")
        updated = update_settings_for_user(session, user_record, section, payload)
        append_audit_log(
            session,
            actor_id=user_record.id,
            actor_role=user_record.role,
            actor_name=user_record.full_name,
            action="update_settings",
            target=f"settings:{section}",
            meta={"section": section},
        )
        return updated


@app.get("/api/dashboard/summary")
def get_dashboard_summary() -> dict[str, Any]:
    cached = cache_get("dashboard:summary", ttl_seconds=45)
    if cached is not None:
        return cached
    with db_session() as session:
        payload = build_dynamic_dashboard(session)
        cache_set("dashboard:summary", payload)
        return payload


@app.get("/api/manager/candidate-workbench")
def get_manager_candidate_workbench(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")
    cache_key = f"manager:workbench:{user.id}"
    cached = cache_get(cache_key, ttl_seconds=20)
    if cached is not None:
        return cached
    with db_session() as session:
        payload = build_manager_candidate_workbench(session)
        cache_set(cache_key, payload)
        return payload


@app.post("/api/manager/interview-schedule")
def create_manager_interview_schedule(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")

    employee_id = str(payload.get("employeeId") or "").strip()
    start_at = parse_iso_datetime(payload.get("startAt"))
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    if not start_at:
        raise HTTPException(status_code=400, detail="A valid interview start time is required")

    duration_minutes = max(15, min(240, int(payload.get("durationMinutes") or 45)))
    end_at = start_at + timedelta(minutes=duration_minutes)

    with db_session() as session:
        employee = session.get(UserRecord, employee_id)
        if not employee or employee.role != "employee":
            raise HTTPException(status_code=404, detail="Candidate not found")

        journey = get_employee_journey_for_user(session, employee.id)
        profile = journey.get("profile", {}) if isinstance(journey.get("profile"), dict) else {}
        employee_settings = get_settings_for_user(session, employee)
        employee_settings_profile = employee_settings.get("profile", {}) if isinstance(employee_settings.get("profile"), dict) else {}

        candidate_name = str(profile.get("fullName") or employee.full_name or "Candidate").strip()
        role = str(profile.get("role") or "Role discussion").strip()
        location = str(payload.get("location") or "").strip()
        notes = str(payload.get("notes") or "").strip()
        meeting_mode = str(payload.get("meetingMode") or "Virtual").strip() or "Virtual"
        title = str(payload.get("title") or f"{role} Interview").strip() or f"{role} Interview"
        whatsapp_country_code = str(payload.get("countryCode") or "").strip()

        entry = {
            "id": f"sched-{uuid4().hex[:10]}",
            "employeeId": employee.id,
            "candidateName": candidate_name,
            "role": role,
            "managerId": user.id,
            "managerName": user.full_name,
            "title": title,
            "meetingMode": meeting_mode,
            "location": location,
            "notes": notes,
            "startAt": start_at.isoformat(),
            "endAt": end_at.isoformat(),
            "durationMinutes": duration_minutes,
            "status": "scheduled",
            "createdAt": datetime.now(UTC).isoformat(),
        }
        schedule_record = ManagerInterviewScheduleRecord(
            id=entry["id"],
            employee_id=entry["employeeId"],
            candidate_name=entry["candidateName"],
            role=entry["role"],
            manager_id=entry["managerId"],
            manager_name=entry["managerName"],
            title=entry["title"],
            meeting_mode=entry["meetingMode"],
            location=entry["location"],
            notes=entry["notes"],
            start_at=entry["startAt"],
            end_at=entry["endAt"],
            duration_minutes=entry["durationMinutes"],
            status=entry["status"],
            created_at=entry["createdAt"],
        )
        session.add(schedule_record)

        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="schedule_interview",
            target=candidate_name,
            meta={"employeeId": employee.id, "title": title, "startAt": entry["startAt"], "meetingMode": meeting_mode},
        )

        candidate_email = str(profile.get("email") or employee_settings_profile.get("email") or employee.email or "").strip()
        candidate_phone = str(payload.get("phoneNumber") or employee_settings_profile.get("phone") or "").strip()
        send_email_notice = bool(payload.get("sendEmail"))
        send_whatsapp_notice = bool(payload.get("sendWhatsApp"))

        if send_email_notice and candidate_email:
            email_body = "\n".join(
                [
                    f"Hi {candidate_name},",
                    "",
                    f"Your interview \"{title}\" has been scheduled.",
                    f"Start: {start_at.astimezone(UTC).strftime('%b %d, %Y %H:%M UTC')}",
                    f"Duration: {duration_minutes} minutes",
                    f"Mode: {meeting_mode}",
                    f"Location / link: {location or 'To be shared'}",
                    "",
                    notes or "Please reply if you need to reschedule.",
                ]
            )
            send_email_async(f"Interview scheduled: {title}", email_body, candidate_email)
            append_manager_communication(
                session,
                {
                    "employeeId": employee.id,
                    "candidateName": candidate_name,
                    "channel": "email",
                    "subject": f"Interview scheduled: {title}",
                    "message": email_body,
                    "recipient": candidate_email,
                    "deliveryStatus": "sent" if smtp_ready() else "recorded",
                    "sentBy": user.full_name,
                },
            )

        whatsapp_link = ""
        if send_whatsapp_notice:
            normalized_whatsapp_phone, _display_phone = validate_whatsapp_phone(candidate_phone, whatsapp_country_code)
            whatsapp_message = (
                f"Hi {candidate_name}, your interview \"{title}\" is scheduled for "
                f"{start_at.astimezone(UTC).strftime('%b %d, %Y %H:%M UTC')}. "
                f"Mode: {meeting_mode}. "
                f"{('Location: ' + location + '. ') if location else ''}"
                "Reply here if you need a change."
            )
            whatsapp_link = build_whatsapp_link(normalized_whatsapp_phone, whatsapp_message)
            append_manager_communication(
                session,
                {
                    "employeeId": employee.id,
                    "candidateName": candidate_name,
                    "channel": "whatsapp",
                    "subject": title,
                    "message": whatsapp_message,
                    "recipientPhone": normalized_whatsapp_phone,
                    "deliveryStatus": "link_ready",
                    "launchUrl": whatsapp_link,
                    "sentBy": user.full_name,
                },
            )

        create_inapp_notification(
            session,
            employee,
            "Interview scheduled",
            f"{title} has been scheduled for {start_at.astimezone(UTC).strftime('%b %d, %Y %H:%M UTC')}.",
            "general",
        )

        cache_invalidate("manager:workbench:*")
        return {
            "schedule": serialize_manager_schedule_record(schedule_record),
            "downloadPath": f"/api/manager/interview-schedule/{entry['id']}/ics",
            "whatsAppLaunchUrl": whatsapp_link,
        }


@app.get("/api/manager/interview-schedule/{schedule_id}/ics")
def download_manager_schedule_ics(schedule_id: str, authorization: str | None = Header(default=None)) -> Response:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        schedule = session.get(ManagerInterviewScheduleRecord, schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Scheduled event not found")
        ics_body = build_schedule_ics(serialize_manager_schedule_record(schedule))
        return Response(
            content=ics_body,
            media_type="text/calendar; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{schedule_id}.ics"'},
        )


@app.delete("/api/manager/interview-schedule/{schedule_id}")
def delete_manager_interview_schedule(schedule_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        schedule = session.get(ManagerInterviewScheduleRecord, schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Scheduled event not found")
        if str(schedule.manager_id or "").strip() and schedule.manager_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="delete_interview_schedule",
            target=schedule.candidate_name or schedule.employee_id,
            meta={"scheduleId": schedule.id, "employeeId": schedule.employee_id, "title": schedule.title},
        )
        session.delete(schedule)
    cache_invalidate("manager:workbench:*")
    return {"success": True, "deletedScheduleId": schedule_id}


@app.post("/api/manager/communications/send")
def send_manager_communication(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")

    employee_id = str(payload.get("employeeId") or "").strip()
    channel = str(payload.get("channel") or "").strip().lower()
    message = str(payload.get("message") or "").strip()
    subject = str(payload.get("subject") or "").strip()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    if channel not in {"email", "whatsapp"}:
        raise HTTPException(status_code=400, detail="Unsupported communication channel")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    with db_session() as session:
        employee = session.get(UserRecord, employee_id)
        if not employee or employee.role != "employee":
            raise HTTPException(status_code=404, detail="Candidate not found")
        journey = get_employee_journey_for_user(session, employee.id)
        profile = journey.get("profile", {}) if isinstance(journey.get("profile"), dict) else {}
        employee_settings = get_settings_for_user(session, employee)
        employee_settings_profile = employee_settings.get("profile", {}) if isinstance(employee_settings.get("profile"), dict) else {}

        candidate_name = str(profile.get("fullName") or employee.full_name or "Candidate").strip()
        recipient_email = str(payload.get("recipient") or profile.get("email") or employee_settings_profile.get("email") or employee.email or "").strip()
        recipient_phone = str(payload.get("phoneNumber") or employee_settings_profile.get("phone") or "").strip()
        country_code = str(payload.get("countryCode") or "").strip()
        launch_url = ""
        delivery_status = "recorded"

        if channel == "email":
            if not recipient_email or "@" not in recipient_email:
                raise HTTPException(status_code=400, detail="A valid recipient email is required")
            send_email_async(subject or f"Update from {user.full_name}", message, recipient_email)
            delivery_status = "sent" if smtp_ready() else "recorded"
        else:
            normalized_whatsapp_phone, _display_phone = validate_whatsapp_phone(recipient_phone, country_code)
            launch_url = build_whatsapp_link(normalized_whatsapp_phone, message)
            delivery_status = "link_ready"

        record = append_manager_communication(
            session,
            {
                "employeeId": employee.id,
                "candidateName": candidate_name,
                "channel": channel,
                "subject": subject,
                "message": message,
                "recipient": recipient_email,
                "recipientPhone": normalized_whatsapp_phone if channel == "whatsapp" else normalize_phone_number(recipient_phone),
                "deliveryStatus": delivery_status,
                "launchUrl": launch_url,
                "sentBy": user.full_name,
            },
        )
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="send_candidate_communication",
            target=candidate_name,
            meta={"channel": channel, "deliveryStatus": delivery_status},
        )
        create_inapp_notification(
            session,
            employee,
            "Manager outreach sent",
            f"{user.full_name} sent you a {channel} update regarding your application.",
            "general",
        )
        cache_invalidate("manager:workbench:*")
        return {"communication": record}


@app.post("/api/manager/communications/enhance")
def enhance_manager_communication(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")

    employee_id = str(payload.get("employeeId") or "").strip()
    channel = str(payload.get("channel") or "").strip().lower()
    if not employee_id:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    if channel not in {"email", "whatsapp"}:
        raise HTTPException(status_code=400, detail="Unsupported communication channel")

    with db_session() as session:
        employee = session.get(UserRecord, employee_id)
        if not employee or employee.role != "employee":
            raise HTTPException(status_code=404, detail="Candidate not found")
        workbench = build_manager_candidate_workbench(session)
        candidate = next((item for item in workbench.get("candidates", []) if str(item.get("employeeId") or "") == employee_id), None)
        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate data not found")

        why = candidate.get("whyThisCandidate", {}) if isinstance(candidate.get("whyThisCandidate"), dict) else {}
        enhanced = enhance_manager_message_with_ai(
            channel=channel,
            candidate_name=str(candidate.get("candidateName") or employee.full_name or "Candidate").strip(),
            role=str(candidate.get("role") or "").strip(),
            recommendation=str(why.get("recommendation") or "").strip(),
            message=str(payload.get("message") or "").strip(),
            subject=str(payload.get("subject") or "").strip(),
            fit_reasons=why.get("fitReasons", []) if isinstance(why.get("fitReasons"), list) else [],
            next_steps=why.get("nextSteps", []) if isinstance(why.get("nextSteps"), list) else [],
        )
        return {"enhanced": enhanced}


@app.put("/api/manager/candidates/{employee_id}/profile")
def update_manager_candidate_profile(employee_id: str, payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")

    with db_session() as session:
        employee = session.get(UserRecord, employee_id)
        if not employee or employee.role != "employee":
            raise HTTPException(status_code=404, detail="Candidate not found")

        journey = get_employee_journey_for_user(session, employee_id)
        current_profile = journey.get("profile", {}) if isinstance(journey.get("profile"), dict) else {}
        normalized_payload = {**current_profile, **payload, "employeeId": employee_id}
        journey["profile"] = normalized_payload
        set_employee_journey_for_user(session, employee_id, journey)

        full_name = str(normalized_payload.get("fullName") or "").strip()
        email = str(normalized_payload.get("email") or "").strip()
        department = str(normalized_payload.get("department") or "").strip()

        if full_name:
            employee.full_name = full_name
        if email:
            employee.email = email
        if department:
            employee.department = department

        for item in session.scalars(select(AssessmentRecord).where(AssessmentRecord.employee_id == employee_id)).all():
            if full_name:
                item.employee = full_name
            current_assessment_profile = loads_json(item.profile_json, {})
            item.profile_json = dumps_json({**current_assessment_profile, **normalized_payload})

        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="manager_update_candidate_profile",
            target=full_name or employee_id,
            meta={"employeeId": employee_id},
        )
        cache_invalidate("resumes:index", "assessments:list", "dashboard:summary", "reports:summary", "manager:workbench:*")

        workbench = build_manager_candidate_workbench(session)
        candidate = next((item for item in workbench.get("candidates", []) if str(item.get("employeeId") or "") == employee_id), None)
        return {"candidate": candidate, "journey": journey}


@app.delete("/api/manager/candidates/{employee_id}")
def delete_manager_candidate(employee_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")

    with db_session() as session:
        employee = session.get(UserRecord, employee_id)
        if not employee or employee.role != "employee":
            raise HTTPException(status_code=404, detail="Candidate not found")

        candidate_name = str(employee.full_name or employee.email or employee_id).strip()
        candidate_email = str(employee.email or "").strip()

        for item in session.scalars(select(ManagerInterviewScheduleRecord).where(ManagerInterviewScheduleRecord.employee_id == employee_id)).all():
            session.delete(item)
        for item in session.scalars(select(ManagerCommunicationRecord).where(ManagerCommunicationRecord.employee_id == employee_id)).all():
            session.delete(item)
        for item in session.scalars(select(AssessmentRecord).where(AssessmentRecord.employee_id == employee_id)).all():
            session.delete(item)
        for item in session.scalars(select(AssessmentAttemptRecord).where(AssessmentAttemptRecord.employee_id == employee_id)).all():
            session.delete(item)
        for item in session.scalars(select(FeedbackSurveyRecord).where(FeedbackSurveyRecord.employee_id == employee_id)).all():
            session.delete(item)
        for item in session.scalars(select(NotificationRecord).where(NotificationRecord.user_id == employee_id)).all():
            session.delete(item)

        legacy_journey = get_state(session, "employeeJourney", DEFAULT_EMPLOYEE_JOURNEY)
        if str((legacy_journey.get("profile") or {}).get("employeeId") or "").strip() == employee_id:
            set_state(session, "employeeJourney", DEFAULT_EMPLOYEE_JOURNEY)
        set_state(session, employee_journey_state_key(employee_id), {})
        set_state(session, user_settings_state_key(employee_id), {})
        set_state(session, f"totp:{employee_id}", {"enabled": False, "secret": ""})

        for token, details in list(ACTIVE_SESSIONS.items()):
            if details.get("userId") == employee_id:
                ACTIVE_SESSIONS.pop(token, None)

        session.delete(employee)

        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="manager_delete_candidate",
            target=candidate_name,
            meta={"employeeId": employee_id, "email": candidate_email},
        )

    cache_invalidate(
        "resumes:index",
        "assessments:list",
        "dashboard:summary",
        "reports:summary",
        "leaderboard:summary",
        "manager:workbench:*",
        "teams:list",
        f"notifications:list:{employee_id}",
    )
    return {"success": True, "deletedCandidateId": employee_id}


@app.get("/api/employees")
def get_employees() -> list[dict[str, Any]]:
    cached = cache_get("employees:list", ttl_seconds=30)
    if cached is not None:
        return cached
    with db_session() as session:
        payload = [serialize_employee(item) for item in session.scalars(select(EmployeeRecord).order_by(EmployeeRecord.id)).all()]
        cache_set("employees:list", payload)
        return payload


@app.post("/api/employees")
def create_employee(payload: dict[str, Any]) -> list[dict[str, Any]]:
    with db_session() as session:
        session.add(EmployeeRecord(name=payload.get("name", ""), email=payload.get("email", ""), role=payload.get("role", ""), skills_json=dumps_json(payload.get("skills", [])), skill_level=float(payload.get("skillLevel", 0)), status=payload.get("status", "pending"), last_assessment=payload.get("lastAssessment", "Never")))
        append_audit_log(
            session,
            actor_id=None,
            actor_role="manager",
            actor_name="Manager",
            action="create_employee",
            target=str(payload.get("email", "")),
            meta={"role": payload.get("role", "")},
        )
    cache_invalidate("employees:list", "roles:list", "dashboard:summary", "manager:workbench:*", "teams:list")
    return get_employees()


@app.put("/api/employees/{employee_id}")
def update_employee(employee_id: int, payload: dict[str, Any]) -> list[dict[str, Any]]:
    with db_session() as session:
        item = session.get(EmployeeRecord, employee_id)
        if not item:
            raise HTTPException(status_code=404, detail="Employee not found")
        item.name = payload.get("name", item.name)
        item.email = payload.get("email", item.email)
        item.role = payload.get("role", item.role)
        item.skills_json = dumps_json(payload.get("skills", loads_json(item.skills_json, [])))
        item.skill_level = float(payload.get("skillLevel", item.skill_level))
        item.status = payload.get("status", item.status)
        item.last_assessment = payload.get("lastAssessment", item.last_assessment)
        append_audit_log(
            session,
            actor_id=None,
            actor_role="manager",
            actor_name="Manager",
            action="update_employee",
            target=f"{item.name} ({item.email})",
            meta={"status": item.status, "role": item.role},
        )
    cache_invalidate("employees:list", "roles:list", "dashboard:summary", "manager:workbench:*", "teams:list")
    return get_employees()


@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: int) -> list[dict[str, Any]]:
    with db_session() as session:
        item = session.get(EmployeeRecord, employee_id)
        if not item:
            raise HTTPException(status_code=404, detail="Employee not found")
        append_audit_log(
            session,
            actor_id=None,
            actor_role="manager",
            actor_name="Manager",
            action="delete_employee",
            target=f"{item.name} ({item.email})",
        )
        session.delete(item)
    cache_invalidate("employees:list", "roles:list", "dashboard:summary", "manager:workbench:*", "teams:list")
    return get_employees()


@app.get("/api/roles")
def get_roles() -> list[dict[str, Any]]:
    cached = cache_get("roles:list", ttl_seconds=30)
    if cached is not None:
        return cached
    with db_session() as session:
        employees = [serialize_employee(item) for item in session.scalars(select(EmployeeRecord).order_by(EmployeeRecord.id)).all()]
        payload = [
            serialize_role(
                item,
                build_role_members(item.name, employees),
            )
            for item in session.scalars(select(RoleRecord).order_by(RoleRecord.id)).all()
        ]
        cache_set("roles:list", payload)
        return payload


@app.get("/api/roles/{role_id}")
def get_role(role_id: int) -> dict[str, Any]:
    with db_session() as session:
        item = session.get(RoleRecord, role_id)
        if not item:
            raise HTTPException(status_code=404, detail="Role not found")
        employees = [serialize_employee(row) for row in session.scalars(select(EmployeeRecord).order_by(EmployeeRecord.id)).all()]
        members = build_role_members(item.name, employees)
        return serialize_role(item, members)


@app.post("/api/roles")
def create_role(payload: dict[str, Any]) -> list[dict[str, Any]]:
    with db_session() as session:
        session.add(RoleRecord(name=payload.get("name", ""), required_skills_json=dumps_json(payload.get("requiredSkills", [])), employees=int(payload.get("employees", 0)), avg_score=float(payload.get("avgScore", 0)), readiness=payload.get("readiness", "Pending"), top_gap=payload.get("topGap", "No data yet"), last_review=payload.get("lastReview", "2026-03-24")))
        append_audit_log(
            session,
            actor_id=None,
            actor_role="manager",
            actor_name="Manager",
            action="create_role",
            target=str(payload.get("name", "")),
        )
    cache_invalidate("roles:list", "dashboard:summary", "manager:workbench:*")
    return get_roles()


@app.put("/api/roles/{role_id}")
def update_role(role_id: int, payload: dict[str, Any]) -> list[dict[str, Any]]:
    with db_session() as session:
        item = session.get(RoleRecord, role_id)
        if not item:
            raise HTTPException(status_code=404, detail="Role not found")
        item.name = payload.get("name", item.name)
        item.required_skills_json = dumps_json(payload.get("requiredSkills", loads_json(item.required_skills_json, [])))
        item.employees = int(payload.get("employees", item.employees))
        item.avg_score = float(payload.get("avgScore", item.avg_score))
        item.readiness = payload.get("readiness", item.readiness)
        item.top_gap = payload.get("topGap", item.top_gap)
        item.last_review = payload.get("lastReview", item.last_review)
        append_audit_log(
            session,
            actor_id=None,
            actor_role="manager",
            actor_name="Manager",
            action="update_role",
            target=item.name,
            meta={"readiness": item.readiness},
        )
    cache_invalidate("roles:list", "dashboard:summary", "manager:workbench:*")
    return get_roles()


@app.delete("/api/roles/{role_id}")
def delete_role(role_id: int) -> list[dict[str, Any]]:
    with db_session() as session:
        item = session.get(RoleRecord, role_id)
        if not item:
            raise HTTPException(status_code=404, detail="Role not found")
        append_audit_log(
            session,
            actor_id=None,
            actor_role="manager",
            actor_name="Manager",
            action="delete_role",
            target=item.name,
        )
        session.delete(item)
    cache_invalidate("roles:list", "dashboard:summary", "manager:workbench:*")
    return get_roles()


@app.get("/api/teams")
def get_teams(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    cached = cache_get("teams:list", ttl_seconds=20)
    if cached is not None:
        return cached
    with db_session() as session:
        employees = [serialize_employee(item) for item in session.scalars(select(EmployeeRecord).order_by(EmployeeRecord.name)).all()]
        employees_by_id = {int(item["id"]): item for item in employees}
        payload = [serialize_team(item, employees_by_id) for item in session.scalars(select(TeamRecord).order_by(TeamRecord.id.asc())).all()]
        cache_set("teams:list", payload)
        return payload


@app.post("/api/teams")
def create_team(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Team name is required")
    now_iso = datetime.now(UTC).isoformat()
    with db_session() as session:
        team = TeamRecord(
            name=name,
            role_focus=str(payload.get("roleFocus") or "").strip(),
            description=str(payload.get("description") or "").strip(),
            required_skills_json=dumps_json(normalize_team_required_skills(payload.get("requiredSkills"))),
            member_employee_ids_json=dumps_json([int(item) for item in payload.get("memberEmployeeIds", []) if str(item).isdigit()]),
            target_size=max(2, min(12, int(payload.get("targetSize") or 4))),
            created_at=now_iso,
            updated_at=now_iso,
        )
        session.add(team)
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="create_team",
            target=name,
            meta={"roleFocus": team.role_focus, "targetSize": team.target_size},
        )
    cache_invalidate("teams:list")
    return get_teams(authorization)


@app.put("/api/teams/{team_id}")
def update_team(team_id: int, payload: dict[str, Any], authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        team = session.get(TeamRecord, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")

        if "name" in payload:
            next_name = str(payload.get("name") or "").strip()
            if not next_name:
                raise HTTPException(status_code=400, detail="Team name is required")
            team.name = next_name
        if "roleFocus" in payload:
            team.role_focus = str(payload.get("roleFocus") or "").strip()
        if "description" in payload:
            team.description = str(payload.get("description") or "").strip()
        if "requiredSkills" in payload:
            team.required_skills_json = dumps_json(normalize_team_required_skills(payload.get("requiredSkills")))
        if "memberEmployeeIds" in payload:
            team.member_employee_ids_json = dumps_json([int(item) for item in payload.get("memberEmployeeIds", []) if str(item).isdigit()])
        if "targetSize" in payload:
            team.target_size = max(2, min(12, int(payload.get("targetSize") or 4)))
        team.updated_at = datetime.now(UTC).isoformat()

        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="update_team",
            target=team.name,
            meta={"teamId": team.id},
        )
    cache_invalidate("teams:list")
    return get_teams(authorization)


@app.delete("/api/teams/{team_id}")
def delete_team(team_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        team = session.get(TeamRecord, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="delete_team",
            target=team.name,
            meta={"teamId": team.id},
        )
        session.delete(team)
    cache_invalidate("teams:list")
    return {"success": True, "deletedTeamId": team_id}


@app.post("/api/teams/{team_id}/members")
def update_team_member(team_id: int, payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    member_id_raw = payload.get("employeeId")
    if member_id_raw is None:
        raise HTTPException(status_code=400, detail="Employee ID is required")
    try:
        member_id = int(member_id_raw)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid employee ID") from exc
    action = str(payload.get("action") or "add").strip().lower()
    if action not in {"add", "remove"}:
        raise HTTPException(status_code=400, detail="Action must be add or remove")

    with db_session() as session:
        team = session.get(TeamRecord, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        member_ids = [int(item) for item in loads_json(team.member_employee_ids_json, []) if str(item).isdigit()]
        if action == "add" and member_id not in member_ids:
            member_ids.append(member_id)
        if action == "remove":
            member_ids = [item for item in member_ids if item != member_id]
        team.member_employee_ids_json = dumps_json(member_ids)
        team.updated_at = datetime.now(UTC).isoformat()
        employees = [serialize_employee(item) for item in session.scalars(select(EmployeeRecord).order_by(EmployeeRecord.name)).all()]
        employees_by_id = {int(item["id"]): item for item in employees}
        serialized = serialize_team(team, employees_by_id)
    cache_invalidate("teams:list")
    return serialized


@app.post("/api/teams/{team_id}/suggest")
def suggest_team_members(team_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        team = session.get(TeamRecord, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        employees = [serialize_employee(item) for item in session.scalars(select(EmployeeRecord).order_by(EmployeeRecord.name)).all()]
        employees_by_id = {int(item["id"]): item for item in employees}
        suggestions = build_team_suggestions(session, team)
        return {
            "team": serialize_team(team, employees_by_id),
            "suggestions": suggestions,
            "method": "ai-heuristic",
            "generatedAt": datetime.now(UTC).isoformat(),
        }


@app.post("/api/teams/{team_id}/apply-suggestion")
def apply_team_suggestion(team_id: int, payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    raw_ids = payload.get("employeeIds", [])
    member_ids = [int(item) for item in raw_ids if str(item).isdigit()]
    with db_session() as session:
        team = session.get(TeamRecord, team_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        team.member_employee_ids_json = dumps_json(member_ids)
        team.updated_at = datetime.now(UTC).isoformat()
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="apply_team_suggestion",
            target=team.name,
            meta={"teamId": team.id, "memberCount": len(member_ids)},
        )
        employees = [serialize_employee(item) for item in session.scalars(select(EmployeeRecord).order_by(EmployeeRecord.name)).all()]
        employees_by_id = {int(item["id"]): item for item in employees}
        serialized = serialize_team(team, employees_by_id)
    cache_invalidate("teams:list")
    return {"team": serialized, "appliedCount": len(member_ids)}


@app.get("/api/rubrics")
def list_rubrics(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        return [serialize_rubric(item) for item in session.scalars(select(RubricTemplateRecord).order_by(RubricTemplateRecord.id.desc())).all()]


@app.post("/api/rubrics")
def create_rubric(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    name = str(payload.get("name", "")).strip()
    description = str(payload.get("description", "")).strip()
    competencies = normalize_competencies(payload.get("competencies"))
    if not name:
        raise HTTPException(status_code=400, detail="Rubric name is required")
    if not competencies:
        raise HTTPException(status_code=400, detail="Add at least one competency")
    with db_session() as session:
        session.add(
            RubricTemplateRecord(
                name=name,
                description=description,
                competencies_json=dumps_json(competencies),
                created_at=datetime.now(UTC).isoformat(),
            )
        )
    return list_rubrics(authorization)


@app.put("/api/rubrics/{rubric_id}")
def update_rubric(rubric_id: int, payload: dict[str, Any], authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        item = session.get(RubricTemplateRecord, rubric_id)
        if not item:
            raise HTTPException(status_code=404, detail="Rubric not found")
        name = str(payload.get("name", item.name)).strip()
        description = str(payload.get("description", item.description)).strip()
        competencies = normalize_competencies(payload.get("competencies", loads_json(item.competencies_json, [])))
        if not name:
            raise HTTPException(status_code=400, detail="Rubric name is required")
        if not competencies:
            raise HTTPException(status_code=400, detail="Add at least one competency")
        item.name = name
        item.description = description
        item.competencies_json = dumps_json(competencies)
    return list_rubrics(authorization)


@app.delete("/api/rubrics/{rubric_id}")
def delete_rubric(rubric_id: int, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        item = session.get(RubricTemplateRecord, rubric_id)
        if not item:
            raise HTTPException(status_code=404, detail="Rubric not found")
        session.delete(item)
    return list_rubrics(authorization)


@app.get("/api/assessment-templates")
def list_assessment_templates(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        return [serialize_assessment_template(item) for item in session.scalars(select(AssessmentTemplateRecord).order_by(AssessmentTemplateRecord.id.desc())).all()]


@app.post("/api/assessment-templates")
def create_assessment_template(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    title = str(payload.get("title", "")).strip()
    description = str(payload.get("description", "")).strip()
    category = str(payload.get("category", "general")).strip() or "general"
    questions = normalize_questions(payload.get("questions"))
    if not title:
        raise HTTPException(status_code=400, detail="Assessment title is required")
    if not questions:
        raise HTTPException(status_code=400, detail="Add at least one valid question")
    with db_session() as session:
        session.add(
            AssessmentTemplateRecord(
                title=title,
                description=description,
                category=category,
                questions_json=dumps_json(questions),
                rubric_id=payload.get("rubricId"),
                created_at=datetime.now(UTC).isoformat(),
            )
        )
    return list_assessment_templates(authorization)


@app.put("/api/assessment-templates/{template_id}")
def update_assessment_template(template_id: int, payload: dict[str, Any], authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        item = session.get(AssessmentTemplateRecord, template_id)
        if not item:
            raise HTTPException(status_code=404, detail="Assessment template not found")
        title = str(payload.get("title", item.title)).strip()
        description = str(payload.get("description", item.description)).strip()
        category = str(payload.get("category", item.category)).strip() or "general"
        questions = normalize_questions(payload.get("questions", loads_json(item.questions_json, [])))
        if not title:
            raise HTTPException(status_code=400, detail="Assessment title is required")
        if not questions:
            raise HTTPException(status_code=400, detail="Add at least one valid question")
        item.title = title
        item.description = description
        item.category = category
        item.questions_json = dumps_json(questions)
        item.rubric_id = payload.get("rubricId", item.rubric_id)
    return list_assessment_templates(authorization)


@app.delete("/api/assessment-templates/{template_id}")
def delete_assessment_template(template_id: int, authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        item = session.get(AssessmentTemplateRecord, template_id)
        if not item:
            raise HTTPException(status_code=404, detail="Assessment template not found")
        session.delete(item)
    return list_assessment_templates(authorization)


@app.get("/api/assessments")
def get_assessments() -> list[dict[str, Any]]:
    cached = cache_get("assessments:list", ttl_seconds=20)
    if cached is not None:
        return cached
    with db_session() as session:
        policy = get_interview_retention_policy(session)
        prune_expired_interview_logs(session, policy)
        data = [
            serialize_assessment(item)
            for item in session.scalars(select(AssessmentRecord).where(AssessmentRecord.source != "seeded")).all()
        ]
        payload = sorted(data, key=lambda item: item.get("date", ""), reverse=True)
        cache_set("assessments:list", payload)
        return payload


@app.get("/api/assessments/{assessment_id}")
def get_assessment_detail(assessment_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        item = session.get(AssessmentRecord, assessment_id)
        if not item:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if user.role == "employee" and item.employee_id and item.employee_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        return serialize_assessment(item)


def require_manager(user: UserRecord | None) -> None:
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.put("/api/assessments/{assessment_id}")
def update_assessment(
    assessment_id: str,
    payload: dict[str, Any],
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        item = session.get(AssessmentRecord, assessment_id)
        if not item:
            raise HTTPException(status_code=404, detail="Assessment not found")

        if "title" in payload:
            item.title = str(payload.get("title") or item.title).strip() or item.title
        if "status" in payload:
            status = str(payload.get("status") or "").strip().lower()
            if status in {"pending", "in-progress", "completed", "submitted"}:
                item.status = status
        if "summary" in payload:
            summary = str(payload.get("summary") or "").strip()
            if summary:
                item.summary = summary
        if "focusArea" in payload:
            item.focus_area = str(payload.get("focusArea") or item.focus_area).strip() or item.focus_area
        if "duration" in payload:
            item.duration = str(payload.get("duration") or item.duration).strip() or item.duration
        if "hiringSignal" in payload:
            item.hiring_signal = str(payload.get("hiringSignal") or item.hiring_signal).strip() or item.hiring_signal
        if "confidence" in payload:
            item.confidence = str(payload.get("confidence") or item.confidence).strip() or item.confidence
        if "score" in payload:
            try:
                next_score = float(payload.get("score"))
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=400, detail="Score must be a number between 0 and 5") from exc
            item.score = max(0.0, min(5.0, next_score))

        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="update_assessment",
            target=f"{item.title} - {item.employee}",
            meta={"assessmentId": assessment_id},
        )
        cache_invalidate("assessments:list", "reports:summary", "leaderboard:summary", "dashboard:summary", "manager:workbench:*")
        return serialize_assessment(item)


@app.get("/api/assessments/{assessment_id}/pdf")
def download_assessment_pdf(assessment_id: str, authorization: str | None = Header(default=None)) -> Response:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        item = session.get(AssessmentRecord, assessment_id)
        if not item:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if user.role == "employee" and item.employee_id and item.employee_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        payload = serialize_assessment(item)
        pdf_bytes = build_assessment_pdf(payload)
        filename = f"report-{assessment_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


@app.post("/api/assessments/{assessment_id}/share")
def create_share_link(assessment_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        item = session.get(AssessmentRecord, assessment_id)
        if not item:
            raise HTTPException(status_code=404, detail="Assessment not found")
        if user.role == "employee" and item.employee_id and item.employee_id != user.id:
            raise HTTPException(status_code=403, detail="Forbidden")
        if not item.share_token:
            item.share_token = secrets.token_urlsafe(18)
        item.share_enabled = True
        item.share_created_at = datetime.now(UTC).isoformat()
        return {"token": item.share_token, "shareEnabled": True}


@app.get("/api/assessments/share/{token}")
def get_shared_assessment(token: str) -> dict[str, Any]:
    with db_session() as session:
        item = session.scalar(select(AssessmentRecord).where(AssessmentRecord.share_token == token))
        if not item or not item.share_enabled:
            raise HTTPException(status_code=404, detail="Shared report not found")
        return serialize_assessment_for_share(item)


@app.get("/api/assessments/share/{token}/pdf")
def download_shared_assessment_pdf(token: str) -> Response:
    with db_session() as session:
        item = session.scalar(select(AssessmentRecord).where(AssessmentRecord.share_token == token))
        if not item or not item.share_enabled:
            raise HTTPException(status_code=404, detail="Shared report not found")
        payload = serialize_assessment_for_share(item)
        pdf_bytes = build_assessment_pdf(payload)
        filename = f"shared-report-{item.id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


@app.delete("/api/assessments/{assessment_id}")
def delete_assessment(assessment_id: str, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        item = session.get(AssessmentRecord, assessment_id)
        if not item:
            raise HTTPException(status_code=404, detail="Assessment not found")
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role=user.role,
            actor_name=user.full_name,
            action="delete_assessment",
            target=f"{item.title} - {item.employee}",
            meta={"assessmentId": assessment_id},
        )
        session.delete(item)
        cache_invalidate(
            "assessments:list",
            "reports:summary",
            "leaderboard:summary",
            "dashboard:summary",
            "resumes:index",
            "employees:list",
            "roles:list",
            "manager:workbench:*",
            "teams:list",
        )
        return {"success": True, "deletedId": assessment_id}


@app.get("/api/audit-logs")
def get_audit_logs_endpoint(
    authorization: str | None = Header(default=None),
    q: str | None = None,
) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        logs = get_audit_logs(session)
        query = str(q or "").strip().lower()
        if not query:
            return logs
        return [
            item
            for item in logs
            if query in str(item.get("actorName", "")).lower()
            or query in str(item.get("actorRole", "")).lower()
            or query in str(item.get("action", "")).lower()
            or query in str(item.get("target", "")).lower()
        ]


@app.get("/api/feedback")
def list_feedback(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    require_manager(user)
    with db_session() as session:
        rows = session.scalars(select(FeedbackSurveyRecord).order_by(FeedbackSurveyRecord.id.desc())).all()
        return [
            {
                "id": row.id,
                "assessmentId": row.assessment_id,
                "employeeId": row.employee_id,
                "responses": loads_json(row.responses_json, {}),
                "submittedAt": row.submitted_at,
            }
            for row in rows
        ]


@app.get("/api/interviews/retention")
def get_interview_retention() -> dict[str, Any]:
    with db_session() as session:
        return get_interview_retention_policy(session)


@app.put("/api/interviews/retention")
def update_interview_retention(payload: dict[str, Any]) -> dict[str, Any]:
    enabled = bool(payload.get("enabled", False))
    window = str(payload.get("window", "1month"))
    if window not in INTERVIEW_RETENTION_WINDOWS:
        raise HTTPException(status_code=400, detail="Invalid retention window")
    next_policy = {"enabled": enabled, "window": window}
    with db_session() as session:
        set_state(session, "interviewRetentionPolicy", next_policy)
        deleted = prune_expired_interview_logs(session, next_policy)
        return {**next_policy, "deletedLogs": deleted}


@app.get("/api/reports")
def get_reports(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    cached = cache_get("reports:summary", ttl_seconds=30)
    if cached is not None:
        return cached
    user = resolve_user_from_auth(authorization)
    with db_session() as session:
        if user and user.role == "manager":
            ensure_weekly_report_notification(session, user)
        payload = build_dynamic_reports(session)
        if user and user.role == "manager":
            ensure_weekly_report_email(session, user, payload)
        cache_set("reports:summary", payload)
        return payload


@app.get("/api/leaderboard")
def get_leaderboard() -> dict[str, Any]:
    cached = cache_get("leaderboard:summary", ttl_seconds=30)
    if cached is not None:
        return cached
    with db_session() as session:
        payload = build_dynamic_leaderboard(session)
        cache_set("leaderboard:summary", payload)
        return payload


@app.get("/api/employee/journey")
def get_employee_journey(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        return get_employee_journey_for_user(session, user.id)


@app.get("/api/employee/assessments")
def list_employee_assessments(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        templates = session.scalars(select(AssessmentTemplateRecord).order_by(AssessmentTemplateRecord.id.desc())).all()
        return [serialize_assessment_template(item) for item in templates]


@app.post("/api/employee/assessments/{template_id}/start")
def start_employee_assessment(template_id: int, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        template = session.get(AssessmentTemplateRecord, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Assessment template not found")
        attempt = AssessmentAttemptRecord(
            template_id=template_id,
            employee_id=user.id,
            status="started",
            started_at=datetime.now(UTC).isoformat(),
            answers_json=dumps_json([]),
            score=0.0,
            result_json=dumps_json({}),
        )
        session.add(attempt)
        session.flush()
        return {
            "attempt": serialize_assessment_attempt(attempt),
            "template": serialize_assessment_template(template),
        }


@app.post("/api/employee/assessments/{attempt_id}/submit")
def submit_employee_assessment(attempt_id: int, payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    answers = payload.get("answers", [])
    with db_session() as session:
        attempt = session.get(AssessmentAttemptRecord, attempt_id)
        if not attempt or attempt.employee_id != user.id:
            raise HTTPException(status_code=404, detail="Assessment attempt not found")
        template = session.get(AssessmentTemplateRecord, attempt.template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Assessment template not found")
        questions = loads_json(template.questions_json, [])
        score, breakdown = compute_template_score(questions, answers)
        submitted_at = datetime.now(UTC)
        attempt.answers_json = dumps_json(answers)
        attempt.score = score
        attempt.status = "submitted"
        attempt.submitted_at = submitted_at.isoformat()
        attempt.result_json = dumps_json({"breakdown": breakdown})
        template_title = str(template.title or "Assessment").strip() or "Assessment"
        employee_name = user.full_name or "Employee"
        score_label = format_score_value(score)
        started_at = parse_record_datetime(attempt.started_at) or submitted_at
        duration_minutes = max(1, int((submitted_at - started_at).total_seconds() // 60))
        duration_label = f"{duration_minutes} min"

        category_label = str(template.category or "general").strip() or "general"
        rubric = session.get(RubricTemplateRecord, template.rubric_id) if template.rubric_id else None
        rubric_competencies = loads_json(rubric.competencies_json, []) if rubric else []

        selected_skills: list[str] = []
        if category_label:
            selected_skills.append(category_label.title())
        for competency in rubric_competencies:
            if not isinstance(competency, dict):
                continue
            name = str(competency.get("name") or "").strip()
            if name:
                selected_skills.append(name)
        for question in questions:
            for keyword in question.get("keywords", []) or []:
                clean = str(keyword).strip()
                if clean:
                    selected_skills.append(clean.title())
        deduped_skills = list(dict.fromkeys(selected_skills))[:10]

        if score >= 4.2:
            hiring_signal = "Strong Hire"
            confidence = "High"
            strengths = ["Consistently strong answers across core questions.", "Shows role-ready decision quality."]
            gaps = ["No critical gaps identified in this template run."]
            recommendations = ["Stretch with advanced scenario-based assessments."]
        elif score >= 3.2:
            hiring_signal = "Potential Match"
            confidence = "Medium"
            strengths = ["Solid baseline understanding of the assessed domain."]
            gaps = ["Some answers need stronger depth or precision."]
            recommendations = ["Run one focused follow-up assessment on weak topics."]
        else:
            hiring_signal = "Needs Support"
            confidence = "Medium"
            strengths = ["Attempt completed and baseline capability captured."]
            gaps = ["Multiple fundamentals need reinforcement before production ownership."]
            recommendations = ["Assign a guided learning plan and reassess in one week."]

        per_domain = [
            {
                "domain": category_label.title(),
                "score": round(score, 2),
                "signal": "Strong" if score >= 4.2 else "Moderate" if score >= 3.2 else "At Risk",
            }
        ]

        journey = get_employee_journey_for_user(session, user.id)
        profile = journey.get("profile", {}) if isinstance(journey.get("profile"), dict) else {}
        resume = journey.get("resume", {}) if isinstance(journey.get("resume"), dict) else {}
        profile_payload = {
            "fullName": str(profile.get("fullName") or employee_name).strip(),
            "email": str(profile.get("email") or user.email or "").strip(),
            "employeeId": user.id,
            "role": str(profile.get("role") or category_label.title()).strip(),
            "department": str(profile.get("department") or user.department or "").strip(),
            "location": str(profile.get("location") or "").strip(),
            "yearsExperience": str(profile.get("yearsExperience") or "").strip(),
            "portfolioUrl": str(profile.get("portfolioUrl") or "").strip(),
            "githubUrl": str(profile.get("githubUrl") or "").strip(),
            "linkedinUrl": str(profile.get("linkedinUrl") or "").strip(),
            "photoData": str(profile.get("photoData") or "").strip(),
            "summary": str(profile.get("summary") or "").strip(),
        }

        upsert_assessment(
            session,
            {
                "id": f"template-{attempt.id}",
                "source": "employee-template-assessment",
                "title": template_title,
                "employee": employee_name,
                "employeeId": user.id,
                "status": "completed",
                "score": round(score, 2),
                "date": submitted_at.isoformat(),
                "duration": duration_label,
                "interviewer": "Assessment Engine",
                "focusArea": category_label.title(),
                "summary": f"{employee_name} scored {score_label}/5 in {template_title}.",
                "highlights": [
                    f"Correct responses: {breakdown.get('correct', 0)}/{breakdown.get('total', 0)}",
                    f"Text evidence hits: {breakdown.get('textHits', 0)}",
                    f"Assessment category: {category_label.title()}",
                ],
                "perDomain": per_domain,
                "answers": answers,
                "profile": profile_payload,
                "resume": resume,
                "selectedSkills": deduped_skills,
                "strengths": strengths,
                "gaps": gaps,
                "recommendations": recommendations,
                "hiringSignal": hiring_signal,
                "confidence": confidence,
                "evaluationMethod": "assessment-template",
            },
        )

        employee_row = session.scalar(select(EmployeeRecord).where(EmployeeRecord.email == user.email))
        if employee_row:
            existing_skills = loads_json(employee_row.skills_json, [])
            merged_skills = list(dict.fromkeys([*existing_skills, *deduped_skills]))[:20]
            employee_row.skills_json = dumps_json(merged_skills)
            employee_row.skill_level = round(score, 2)
            employee_row.status = "active"
            employee_row.last_assessment = submitted_at.date().isoformat()
            if not str(employee_row.role or "").strip():
                employee_row.role = profile_payload["role"] or "Employee"
        else:
            session.add(
                EmployeeRecord(
                    name=employee_name,
                    email=user.email,
                    role=profile_payload["role"] or "Employee",
                    skills_json=dumps_json(deduped_skills),
                    skill_level=round(score, 2),
                    status="active",
                    last_assessment=submitted_at.date().isoformat(),
                )
            )

        employee_email = get_user_email_for_notifications(session, user)
        if employee_email and wants_email_notifications(session, user, "assessment"):
            send_email_async(
                f"Assessment submitted: {template_title}",
                "\n".join(
                    [
                        f"Hi {employee_name},",
                        "",
                        f"Your assessment \"{template_title}\" was submitted successfully.",
                        "",
                        "You can review the results in your dashboard.",
                    ]
                ),
                employee_email,
            )

        manager_recipients = get_manager_recipients(session, "assessment")
        if manager_recipients:
            send_email_async(
                f"Assessment submitted by {employee_name}",
                "\n".join(
                    [
                        f"{employee_name} submitted the assessment \"{template_title}\".",
                        "",
                        "Open the manager dashboard to review details.",
                    ]
                ),
                manager_recipients,
            )
        create_inapp_notification(
            session,
            user,
            f"Assessment submitted: {template_title}",
            f"Your assessment \"{template_title}\" was submitted successfully.",
            "assessment",
        )
        managers = session.scalars(select(UserRecord).where(UserRecord.role == "manager")).all()
        for manager in managers:
            create_inapp_notification(
                session,
                manager,
                f"Assessment submitted by {employee_name}",
                f"{employee_name} submitted \"{template_title}\".",
                "assessment",
            )
        cache_invalidate(
            "assessments:list",
            "reports:summary",
            "leaderboard:summary",
            "dashboard:summary",
            "employees:list",
            "roles:list",
            "manager:workbench:*",
            "teams:list",
            f"notifications:list:{user.id}",
            *(f"notifications:list:{manager.id}" for manager in managers),
        )
        return {
            "attempt": serialize_assessment_attempt(attempt),
            "template": serialize_assessment_template(template),
        }


@app.get("/api/employee/assessments/history")
def list_employee_assessment_history(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        attempts = session.scalars(select(AssessmentAttemptRecord).where(AssessmentAttemptRecord.employee_id == user.id).order_by(AssessmentAttemptRecord.id.desc())).all()
        return [serialize_assessment_attempt(item) for item in attempts]


@app.post("/api/employee/feedback")
def submit_employee_feedback(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        survey = FeedbackSurveyRecord(
            assessment_id=payload.get("assessmentId"),
            employee_id=user.id,
            responses_json=dumps_json(payload.get("responses", {})),
            submitted_at=datetime.now(UTC).isoformat(),
        )
        session.add(survey)
        return {"success": True}


@app.put("/api/employee/profile")
def save_employee_profile(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        journey = get_employee_journey_for_user(session, user.id)
        normalized_payload = {**payload, "employeeId": user.id}
        journey["profile"] = normalized_payload
        set_employee_journey_for_user(session, user.id, journey)
        employee_id = user.id
        full_name = str(normalized_payload.get("fullName") or "").strip()
        email = str(normalized_payload.get("email") or "").strip()
        department = str(normalized_payload.get("department") or "").strip()

        if employee_id:
            user = session.get(UserRecord, employee_id)
            if user and user.role == "employee":
                if full_name:
                    user.full_name = full_name
                if email:
                    user.email = email
                if department:
                    user.department = department

            for item in session.scalars(select(AssessmentRecord).where(AssessmentRecord.employee_id == employee_id)).all():
                if full_name:
                    item.employee = full_name
                current_profile = loads_json(item.profile_json, {})
                item.profile_json = dumps_json({**current_profile, **normalized_payload})

        append_audit_log(
            session,
            actor_id=user.id,
            actor_role="employee",
            actor_name=full_name or user.full_name,
            action="update_profile",
            target="employee_profile",
            meta={"employeeId": employee_id},
        )
        cache_invalidate("resumes:index", "manager:workbench:*")

        return journey


@app.put("/api/employee/resume")
def save_employee_resume(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if not is_pdf_resume(payload):
        raise HTTPException(status_code=400, detail="Resume must be uploaded as a PDF file")

    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")

    with db_session() as session:
        journey = get_employee_journey_for_user(session, user.id)
        journey["resume"] = payload
        analysis = analyze_resume_payload(payload)
        journey["resumeAnalysis"] = analysis
        journey["resumeAnalyzedAt"] = datetime.now(UTC).isoformat()
        journey["resumeAnalysisStatus"] = analysis.get("status", "ready")
        journey["jobMatchAnalysis"] = {}
        journey["jobMatchAnalyzedAt"] = ""
        set_employee_journey_for_user(session, user.id, journey)
        employee_id = user.id
        if employee_id:
            try:
                update_resume_for_employee(session, employee_id, payload)
            except HTTPException:
                pass
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role="employee",
            actor_name=user.full_name,
            action="upload_resume",
            target=str(payload.get("fileName", "resume")),
            meta={"employeeId": employee_id},
        )
        employee_name = user.full_name or "Employee"
        file_name = str(payload.get("fileName") or "resume").strip() or "resume"

        employee_email = get_user_email_for_notifications(session, user)
        if employee_email and wants_email_notifications(session, user, "general"):
            send_email_async(
                "Resume updated",
                "\n".join(
                    [
                        f"Hi {employee_name},",
                        "",
                        f"Your resume \"{file_name}\" was uploaded successfully.",
                        "You can review it in your profile.",
                    ]
                ),
                employee_email,
            )

        manager_recipients = get_manager_recipients(session, "general")
        if manager_recipients:
            send_email_async(
                f"Resume updated by {employee_name}",
                "\n".join(
                    [
                        f"{employee_name} uploaded a new resume.",
                        f"File: {file_name}",
                        "",
                        "Open the manager dashboard to review the file.",
                    ]
                ),
                manager_recipients,
            )
        create_inapp_notification(
            session,
            user,
            "Resume updated",
            f"Your resume \"{file_name}\" was uploaded successfully.",
            "general",
        )
        managers = session.scalars(select(UserRecord).where(UserRecord.role == "manager")).all()
        for manager in managers:
            create_inapp_notification(
                session,
                manager,
                f"Resume updated by {employee_name}",
                f"{employee_name} uploaded a new resume: {file_name}.",
                "general",
            )
        cache_invalidate("resumes:index", "manager:workbench:*")
        return journey


@app.get("/api/employee/resume/{employee_id}/download")
def download_employee_resume(employee_id: str) -> Response:
    with db_session() as session:
        resume = load_resume_for_employee(session, employee_id)

    file_bytes, media_type, file_name = decode_resume_payload(resume)
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
    )


@app.get("/api/employee/resume/{employee_id}/view")
def view_employee_resume(employee_id: str) -> Response:
    with db_session() as session:
        resume = load_resume_for_employee(session, employee_id)

    file_bytes, media_type, file_name = decode_resume_payload(resume)
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{file_name}"'},
    )


@app.put("/api/employee/resume/{employee_id}")
def update_employee_resume(employee_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not is_pdf_resume(payload):
        raise HTTPException(status_code=400, detail="Resume must be uploaded as a PDF file")

    with db_session() as session:
        updated_resume = update_resume_for_employee(session, employee_id, payload)
        journey = get_employee_journey_for_user(session, employee_id)
        journey["resume"] = payload
        analysis = analyze_resume_payload(payload)
        journey["resumeAnalysis"] = analysis
        journey["resumeAnalyzedAt"] = datetime.now(UTC).isoformat()
        journey["resumeAnalysisStatus"] = analysis.get("status", "ready")
        journey["jobMatchAnalysis"] = {}
        journey["jobMatchAnalyzedAt"] = ""
        set_employee_journey_for_user(session, employee_id, journey)
        cache_invalidate("resumes:index", "manager:workbench:*")
        return {"success": True, "employeeId": employee_id, "resume": updated_resume}


@app.post("/api/employee/resume/analyze")
def analyze_employee_resume(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        journey = get_employee_journey_for_user(session, user.id)
        resume = journey.get("resume", {}) if isinstance(journey.get("resume"), dict) else {}
        if not resume or not resume.get("fileName"):
            raise HTTPException(status_code=404, detail="Resume not found")
        analysis = analyze_resume_payload(resume)
        journey["resumeAnalysis"] = analysis
        journey["resumeAnalyzedAt"] = datetime.now(UTC).isoformat()
        journey["resumeAnalysisStatus"] = analysis.get("status", "ready")
        set_employee_journey_for_user(session, user.id, journey)
        return {
            "resumeAnalysis": analysis,
            "resumeAnalyzedAt": journey["resumeAnalyzedAt"],
            "resumeAnalysisStatus": journey["resumeAnalysisStatus"],
        }


@app.post("/api/employee/resume/job-match")
def analyze_employee_resume_job_match(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")

    job_description = " ".join(str(payload.get("jobDescription") or "").split()).strip()
    if len(job_description) < 40:
        raise HTTPException(status_code=400, detail="Please paste a fuller job description before running match analysis")

    with db_session() as session:
        journey = get_employee_journey_for_user(session, user.id)
        resume = journey.get("resume", {}) if isinstance(journey.get("resume"), dict) else {}
        if not resume or not resume.get("fileName"):
            raise HTTPException(status_code=404, detail="Resume not found")

        resume_analysis = journey.get("resumeAnalysis", {}) if isinstance(journey.get("resumeAnalysis"), dict) else {}
        if not resume_analysis or resume_analysis.get("status") == "unreadable":
            resume_analysis = analyze_resume_payload(resume)
            journey["resumeAnalysis"] = resume_analysis
            journey["resumeAnalyzedAt"] = datetime.now(UTC).isoformat()
            journey["resumeAnalysisStatus"] = resume_analysis.get("status", "ready")

        match_analysis = analyze_job_match(
            journey=journey,
            job_description=job_description,
            resume_analysis=resume_analysis,
        )
        journey["jobDescription"] = job_description
        journey["jobMatchAnalysis"] = match_analysis
        journey["jobMatchAnalyzedAt"] = datetime.now(UTC).isoformat()
        set_employee_journey_for_user(session, user.id, journey)
        return {
            "jobDescription": journey["jobDescription"],
            "jobMatchAnalysis": journey["jobMatchAnalysis"],
            "jobMatchAnalyzedAt": journey["jobMatchAnalyzedAt"],
            "resumeAnalysis": journey.get("resumeAnalysis", {}),
            "resumeAnalyzedAt": journey.get("resumeAnalyzedAt", ""),
            "resumeAnalysisStatus": journey.get("resumeAnalysisStatus", ""),
        }


@app.delete("/api/employee/resume/{employee_id}")
def delete_employee_resume(employee_id: str) -> dict[str, Any]:
    with db_session() as session:
        update_resume_for_employee(session, employee_id, {})
        journey = get_employee_journey_for_user(session, employee_id)
        journey["resume"] = {}
        journey["resumeAnalysis"] = {}
        journey["resumeAnalyzedAt"] = ""
        journey["resumeAnalysisStatus"] = ""
        journey["jobMatchAnalysis"] = {}
        journey["jobMatchAnalyzedAt"] = ""
        set_employee_journey_for_user(session, employee_id, journey)
        cache_invalidate("resumes:index", "manager:workbench:*")
        return {"success": True, "employeeId": employee_id}


@app.get("/api/employee/resume-index")
def list_employee_resume_index(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "manager":
        raise HTTPException(status_code=401, detail="Unauthorized")

    cached = cache_get("resumes:index", ttl_seconds=30)
    if cached is not None:
        return cached

    with db_session() as session:
        users = session.scalars(select(UserRecord).where(UserRecord.role == "employee")).all()
        latest_assessment_by_employee: dict[str, dict[str, Any]] = {}
        latest_assessment_sort_keys: dict[str, tuple[float, str]] = {}
        assessment_rows = session.execute(
            select(
                AssessmentRecord.employee_id,
                AssessmentRecord.date,
                AssessmentRecord.score,
                AssessmentRecord.profile_json,
                AssessmentRecord.resume_json,
            ).where(AssessmentRecord.source != "seeded")
        ).all()
        for row in assessment_rows:
            employee_id = str(row.employee_id or "").strip()
            if not employee_id:
                continue
            date_value = str(row.date or "").strip()
            parsed = parse_iso_datetime(date_value)
            sort_key = (parsed.timestamp() if parsed else 0.0, date_value)
            previous_key = latest_assessment_sort_keys.get(employee_id)
            if previous_key is not None and sort_key <= previous_key:
                continue
            latest_assessment_sort_keys[employee_id] = sort_key
            latest_assessment_by_employee[employee_id] = {
                "date": date_value,
                "score": float(row.score or 0),
                "profile": loads_json(row.profile_json, {}),
                "resume": loads_json(row.resume_json, {}),
            }

        rows: list[dict[str, Any]] = []
        for employee in users:
            journey = get_employee_journey_for_user(session, employee.id)
            profile = journey.get("profile", {}) if isinstance(journey.get("profile"), dict) else {}
            resume = journey.get("resume", {}) if isinstance(journey.get("resume"), dict) else {}
            assessment = latest_assessment_by_employee.get(employee.id, {})
            assessment_profile = assessment.get("profile", {}) if isinstance(assessment.get("profile"), dict) else {}
            assessment_resume = assessment.get("resume", {}) if isinstance(assessment.get("resume"), dict) else {}

            if not resume.get("fileName"):
                resume = assessment_resume

            merged_profile = {
                "fullName": profile.get("fullName") or employee.full_name,
                "email": profile.get("email") or employee.email,
                "employeeId": employee.id,
                "role": profile.get("role") or assessment_profile.get("role") or "",
                "department": profile.get("department") or employee.department or "",
                "location": profile.get("location") or assessment_profile.get("location") or "",
                "yearsExperience": profile.get("yearsExperience") or assessment_profile.get("yearsExperience") or "",
                "portfolioUrl": profile.get("portfolioUrl") or assessment_profile.get("portfolioUrl") or "",
                "githubUrl": profile.get("githubUrl") or assessment_profile.get("githubUrl") or "",
                "linkedinUrl": profile.get("linkedinUrl") or assessment_profile.get("linkedinUrl") or "",
                "photoData": profile.get("photoData") or assessment_profile.get("photoData") or "",
            }

            rows.append(
                {
                    "employeeId": employee.id,
                    "employee": merged_profile["fullName"],
                    "profile": merged_profile,
                    "resume": {
                        "fileName": resume.get("fileName", ""),
                        "uploadedAt": resume.get("uploadedAt", ""),
                        "fileSize": resume.get("fileSize", 0),
                        "contentType": resume.get("contentType", ""),
                    },
                    "latestAssessmentDate": assessment.get("date", ""),
                    "latestScore": assessment.get("score", 0),
                }
            )

        payload = sorted(rows, key=lambda row: str(row.get("employee", "")).lower())
        cache_set("resumes:index", payload)
        return payload


@app.put("/api/employee/domains")
def save_employee_domains(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        journey = get_employee_journey_for_user(session, user.id)
        journey["domains"] = payload.get("domains", [])
        journey["skills"] = payload.get("skills", [])
        journey["interviewReady"] = bool(journey["domains"] and journey["skills"])
        set_employee_journey_for_user(session, user.id, journey)
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role="employee",
            actor_name=user.full_name,
            action="update_domains",
            target="employee_domains",
            meta={"domains": journey["domains"], "skillsCount": len(journey["skills"])},
        )
        cache_invalidate("resumes:index", "manager:workbench:*")
        return journey


@app.get("/api/employee/interview/questions")
def get_employee_interview_questions(authorization: str | None = Header(default=None)) -> list[dict[str, str]]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        journey = get_employee_journey_for_user(session, user.id)
        questions = build_questions(journey.get("domains", []), merge_resume_skills(journey))
        resume_question = build_resume_focus_question(journey)
        if resume_question:
            questions = [resume_question, *questions]
        return questions


@app.get("/api/employee/interview/session")
def get_employee_interview_session(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        journey = get_employee_journey_for_user(session, user.id)
        chat_state = start_interview_chat_session(journey)
        chat_state["userId"] = user.id
        save_interview_chat_state(session, chat_state)
        journey["activeInterviewSessionId"] = chat_state["sessionId"]
        set_employee_journey_for_user(session, user.id, journey)
        return {
            "sessionId": chat_state["sessionId"],
            "messages": chat_state.get("messages", []),
            "canComplete": chat_state.get("canComplete", False),
            "proctoring": chat_state.get("proctoring", {"warningCount": 0, "maxWarnings": 3, "blocked": False, "cancelled": False}),
        }


@app.post("/api/employee/interview/chat")
def chat_employee_interview(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")

    session_id = str(payload.get("sessionId") or "").strip()
    message = str(payload.get("message") or "").strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="Interview session ID is required")
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")

    with db_session() as session:
        chat_state = get_interview_chat_state(session, session_id)
        if not chat_state:
            raise HTTPException(status_code=404, detail="Interview session not found or expired")
        if chat_state.get("userId") and chat_state.get("userId") != user.id:
            raise HTTPException(status_code=403, detail="This interview session belongs to another employee")
        proctoring = chat_state.get("proctoring", {}) if isinstance(chat_state.get("proctoring"), dict) else {}
        if bool(proctoring.get("cancelled")):
            raise HTTPException(status_code=403, detail="Interview cancelled after repeated proctoring warnings")
        if bool(proctoring.get("blocked")):
            raise HTTPException(status_code=403, detail="Multiple people detected. Return to single-person camera view to continue.")
        turn = apply_chat_turn(chat_state, message)
        save_interview_chat_state(session, chat_state)
        return {
            "sessionId": session_id,
            "assistantMessage": turn["assistantMessage"],
            "canComplete": turn["canComplete"],
            "messages": chat_state.get("messages", []),
        }


@app.post("/api/employee/interview/proctoring")
def report_employee_interview_proctoring(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")

    session_id = str(payload.get("sessionId") or "").strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="Interview session ID is required")

    event_type = str(payload.get("eventType") or "proctoring_event").strip() or "proctoring_event"
    action = str(payload.get("action") or "warn").strip().lower()
    if action not in {"warn", "clear", "cancel"}:
        action = "warn"

    try:
        person_count = max(0, min(8, int(payload.get("personCount", 0))))
    except (TypeError, ValueError):
        person_count = 0

    with db_session() as session:
        chat_state = get_interview_chat_state(session, session_id)
        if not chat_state:
            raise HTTPException(status_code=404, detail="Interview session not found or expired")
        if chat_state.get("userId") and chat_state.get("userId") != user.id:
            raise HTTPException(status_code=403, detail="This interview session belongs to another employee")

        proctoring = chat_state.get("proctoring")
        if not isinstance(proctoring, dict):
            proctoring = {}

        max_warnings = int(proctoring.get("maxWarnings", 3) or 3)
        max_warnings = max(1, min(6, max_warnings))
        previous_warning_count = int(proctoring.get("warningCount", 0) or 0)
        warning_count = previous_warning_count
        if action in {"warn", "cancel"}:
            provided_warning = payload.get("warningCount")
            if isinstance(provided_warning, (int, float)):
                warning_count = max(warning_count, int(provided_warning))
            else:
                warning_count += 1
            warning_count = min(max_warnings, warning_count)

        blocked = bool(proctoring.get("blocked"))
        cancelled = bool(proctoring.get("cancelled"))
        if action in {"warn", "cancel"} and person_count > 1:
            blocked = True
        if action == "clear" and person_count <= 1 and not cancelled:
            blocked = False
        if action == "cancel" or warning_count >= max_warnings:
            cancelled = True
            blocked = True
            chat_state["canComplete"] = False

        now_iso = datetime.now(UTC).isoformat()
        events = proctoring.get("events", [])
        if not isinstance(events, list):
            events = []
        events.append(
            {
                "id": f"proctor-{uuid4().hex[:10]}",
                "eventType": event_type,
                "action": action,
                "personCount": person_count,
                "warningCount": warning_count,
                "createdAt": now_iso,
            }
        )
        events = events[-40:]

        last_notice_warning = int(proctoring.get("lastManagerNoticeWarning", 0) or 0)
        should_notify_manager = action in {"warn", "cancel"} and warning_count > last_notice_warning
        if should_notify_manager:
            proctoring["lastManagerNoticeWarning"] = warning_count

        proctoring.update(
            {
                "warningCount": warning_count,
                "maxWarnings": max_warnings,
                "blocked": blocked,
                "cancelled": cancelled,
                "lastPersonCount": person_count,
                "lastEventAt": now_iso,
                "events": events,
            }
        )
        chat_state["proctoring"] = proctoring
        save_interview_chat_state(session, chat_state)

        if cancelled:
            journey = get_employee_journey_for_user(session, user.id)
            if str(journey.get("activeInterviewSessionId") or "").strip() == session_id:
                journey["activeInterviewSessionId"] = None
                set_employee_journey_for_user(session, user.id, journey)

        status_value = "inactive" if cancelled else ("pending" if warning_count > 0 else "active")
        sync_employee_record_status(session, user, status_value)

        employee_message = (
            "Interview cancelled after 3 proctoring warnings (multiple people detected)."
            if cancelled
            else (
                f"Proctoring warning {warning_count}/{max_warnings}: multiple people detected on camera."
                if action in {"warn", "cancel"}
                else "Single-person camera view restored. You can continue."
            )
        )
        create_inapp_notification(
            session,
            user,
            "Interview proctoring update",
            employee_message,
            "security",
        )

        manager_ids: list[str] = []
        if should_notify_manager:
            managers = session.scalars(select(UserRecord).where(UserRecord.role == "manager")).all()
            for manager in managers:
                manager_ids.append(manager.id)
                create_inapp_notification(
                    session,
                    manager,
                    f"Proctoring warning for {user.full_name}",
                    (
                        f"{user.full_name} triggered warning {warning_count}/{max_warnings} during AI interview "
                        f"(detected people: {person_count})."
                        + (" Interview has been cancelled." if cancelled else "")
                    ),
                    "security",
                )
            append_audit_log(
                session,
                actor_id=user.id,
                actor_role="employee",
                actor_name=user.full_name,
                action="interview_proctoring_warning",
                target=session_id,
                meta={"warningCount": warning_count, "personCount": person_count, "cancelled": cancelled},
            )
        cache_invalidate(
            "employees:list",
            "dashboard:summary",
            "manager:workbench:*",
            "teams:list",
            f"notifications:list:{user.id}",
            *(f"notifications:list:{manager_id}" for manager_id in manager_ids),
        )
        return {
            "success": True,
            "sessionId": session_id,
            "warningCount": warning_count,
            "maxWarnings": max_warnings,
            "blocked": blocked,
            "cancelled": cancelled,
            "personCount": person_count,
            "status": status_value,
        }


@app.post("/api/employee/interview/complete")
def complete_employee_interview(payload: dict[str, Any], authorization: str | None = Header(default=None)) -> dict[str, Any]:
    user = resolve_user_from_auth(authorization)
    if not user or user.role != "employee":
        raise HTTPException(status_code=401, detail="Unauthorized")
    with db_session() as session:
        journey = get_employee_journey_for_user(session, user.id)
        session_id = str(payload.get("sessionId") or "").strip()
        submitted_answers = payload.get("answers", [])
        if session_id:
            chat_state = get_interview_chat_state(session, session_id)
            if chat_state and chat_state.get("userId") and chat_state.get("userId") != user.id:
                raise HTTPException(status_code=403, detail="This interview session belongs to another employee")
            if chat_state:
                proctoring_state = chat_state.get("proctoring", {}) if isinstance(chat_state.get("proctoring"), dict) else {}
                if bool(proctoring_state.get("cancelled")):
                    raise HTTPException(status_code=403, detail="Interview was cancelled due to proctoring violations")
                if bool(proctoring_state.get("blocked")):
                    raise HTTPException(status_code=403, detail="Return to single-person camera view before completing")
            if chat_state and chat_state.get("answers"):
                submitted_answers = chat_state.get("answers", [])

        result = evaluate_interview(
            journey,
            submitted_answers,
            int(payload.get("durationMinutes", 0)),
        )
        result = refine_evaluation_with_gemini(result, journey, submitted_answers)
        upsert_assessment(session, result)
        cache_invalidate("assessments:list", "reports:summary", "leaderboard:summary", "dashboard:summary", "resumes:index", "manager:workbench:*")
        journey["latestResultId"] = result["id"]
        if session_id:
            journey["activeInterviewSessionId"] = None
            INTERVIEW_CHAT_SESSIONS.pop(session_id, None)
            set_state(session, f"interviewChat:{session_id}", {})
        set_employee_journey_for_user(session, user.id, journey)
        append_audit_log(
            session,
            actor_id=user.id,
            actor_role="employee",
            actor_name=user.full_name,
            action="complete_interview",
            target=result["title"],
            meta={"score": result["score"], "hiringSignal": result["hiringSignal"]},
        )
        employee_name = user.full_name or "Employee"
        interview_title = str(result.get("title") or "Interview").strip() or "Interview"
        score_label = format_score_value(result.get("score"))

        employee_email = get_user_email_for_notifications(session, user)
        if employee_email and wants_email_notifications(session, user, "assessment"):
            send_email_async(
                f"Interview completed: {interview_title}",
                "\n".join(
                    [
                        f"Hi {employee_name},",
                        "",
                        f"Your interview \"{interview_title}\" is complete.",
                        f"Score: {score_label}",
                        "",
                        "Your report is now available in your dashboard.",
                    ]
                ),
                employee_email,
            )

        manager_recipients = get_manager_recipients(session, "assessment")
        if manager_recipients:
            send_email_async(
                f"Interview completed by {employee_name}",
                "\n".join(
                    [
                        f"{employee_name} completed the interview \"{interview_title}\".",
                        f"Score: {score_label}",
                        "",
                        "Open the manager dashboard to review the full report.",
                    ]
                ),
                manager_recipients,
            )
        create_inapp_notification(
            session,
            user,
            f"Interview completed: {interview_title}",
            f"Your interview \"{interview_title}\" is complete with score {score_label}.",
            "assessment",
        )
        sync_employee_record_status(session, user, "active", last_assessment=datetime.now(UTC).date().isoformat())
        managers = session.scalars(select(UserRecord).where(UserRecord.role == "manager")).all()
        for manager in managers:
            create_inapp_notification(
                session,
                manager,
                f"Interview completed by {employee_name}",
                f"{employee_name} completed \"{interview_title}\" (score {score_label}).",
                "assessment",
            )
        return result
