from __future__ import annotations

from datetime import UTC, datetime
import re
from uuid import uuid4

from .resume_pdf import extract_resume_text


DOMAIN_TITLES = {
    "frontend": "Frontend Engineering",
    "backend": "Backend Engineering",
    "database": "Databases & Storage",
    "devops": "Cloud & DevOps",
    "mobile": "Mobile Development",
    "data-ai": "Data & AI",
    "qa": "QA & Automation",
    "security": "Security Engineering",
}

DOMAIN_KEYWORDS = {
    "frontend": ["react", "typescript", "javascript", "css", "component", "state", "accessibility", "ui"],
    "backend": ["python", "fastapi", "node", "api", "authentication", "cache", "queue", "service"],
    "database": ["sql", "postgres", "mysql", "redis", "migration", "index", "query", "schema"],
    "devops": ["docker", "kubernetes", "ci", "cd", "aws", "terraform", "monitoring", "deploy"],
    "mobile": ["react native", "flutter", "swift", "kotlin", "offline", "push"],
    "data-ai": ["model", "llm", "prompt", "vector", "etl", "pandas", "machine learning"],
    "qa": ["test", "playwright", "cypress", "selenium", "regression", "coverage"],
    "security": ["owasp", "jwt", "rbac", "secret", "threat", "compliance"],
}

EVIDENCE_WORDS = ["built", "implemented", "designed", "optimized", "measured", "debugged", "deployed", "migrated"]
TRADEOFF_WORDS = ["because", "however", "tradeoff", "constraint", "decision", "instead", "balanced"]
OUTCOME_WORDS = ["reduced", "improved", "increased", "latency", "reliability", "result", "impact", "performance"]
GAP_WORDS = ["improve", "learning", "practice", "gap", "feedback", "study", "mentor", "review"]
LOW_SIGNAL_PHRASES = [
    "idk",
    "i dont know",
    "i don't know",
    "no idea",
    "blah",
    "whatever",
    "nothing",
    "not sure",
    "cant answer",
    "can't answer",
]
FILLER_TOKENS = {
    "um",
    "uh",
    "hmm",
    "like",
    "actually",
    "basically",
    "literally",
    "you know",
}


def _normalize_url(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if text.startswith("http://") or text.startswith("https://"):
        return text
    return f"https://{text}"


def _extract_resume_keywords(resume_payload: dict, max_pages: int = 6, max_terms: int = 45) -> set[str]:
    raw_text = extract_resume_text(resume_payload, max_pages=max_pages)
    tokens = _tokenize(raw_text)
    if not tokens:
        return set()
    filtered = [token for token in tokens if len(token) > 2 and not token.isdigit()]
    freq: dict[str, int] = {}
    for token in filtered:
        freq[token] = freq.get(token, 0) + 1
    ordered = sorted(freq.items(), key=lambda item: item[1], reverse=True)
    return {token for token, _ in ordered[:max_terms]}


def _skill_tokens(selected_skills: list[str]) -> set[str]:
    text = " ".join(str(skill or "") for skill in selected_skills)
    return {token for token in _tokenize(text) if len(token) > 2}


def _profile_signal(profile: dict, selected_skills: list[str]) -> tuple[float, list[str], list[str], list[str], list[str]]:
    strengths: list[str] = []
    gaps: list[str] = []
    recommendations: list[str] = []
    highlights: list[str] = []
    bonus = 0.0

    has_photo = bool(str(profile.get("photoData") or "").strip())
    portfolio_url = _normalize_url(str(profile.get("portfolioUrl") or ""))
    github_url = _normalize_url(str(profile.get("githubUrl") or ""))
    linkedin_url = _normalize_url(str(profile.get("linkedinUrl") or ""))
    years_experience_raw = str(profile.get("yearsExperience") or "").strip()
    years_experience = float(years_experience_raw) if years_experience_raw.replace(".", "", 1).isdigit() else 0.0

    if has_photo:
        bonus += 0.05
        highlights.append("Professional profile photo provided")
    else:
        gaps.append("Profile photo is missing")
        recommendations.append("Add a professional profile photo to complete the manager profile card.")

    link_count = len([item for item in [portfolio_url, github_url, linkedin_url] if item])
    if portfolio_url:
        bonus += 0.1
        strengths.append("Portfolio evidence is available for manager review")
    else:
        gaps.append("Portfolio link is missing")
        recommendations.append("Add a portfolio URL with 2-3 projects and measurable outcomes.")

    if github_url:
        bonus += 0.08
        strengths.append("GitHub profile supplied for code-level validation")
    if linkedin_url:
        bonus += 0.05
        strengths.append("LinkedIn profile supplied for role history validation")
    if link_count < 2:
        recommendations.append("Add GitHub and LinkedIn URLs to improve confidence in profile verification.")

    if years_experience >= 5:
        bonus += 0.08
        highlights.append("Experience depth aligns with senior responsibilities")
    elif years_experience >= 2:
        bonus += 0.04
        highlights.append("Experience depth supports mid-level responsibilities")
    else:
        recommendations.append("Include accurate years of experience for stronger role-fit calibration.")

    if selected_skills and portfolio_url:
        strengths.append(f"Portfolio can be mapped against selected skills: {', '.join(selected_skills[:3])}")

    return bonus, strengths[:3], gaps[:2], recommendations[:3], highlights[:3]


def build_questions(domains: list[str], skills: list[str]) -> list[dict[str, str]]:
    questions: list[dict[str, str]] = []
    for domain in domains:
        title = DOMAIN_TITLES.get(domain, domain)
        scoped_skills = [skill for skill in skills if skill.lower() in " ".join(DOMAIN_KEYWORDS.get(domain, []))][:3]
        subject = ", ".join(scoped_skills) if scoped_skills else title
        questions.extend(
            [
                {
                    "id": f"{domain}-delivery",
                    "domainId": domain,
                    "question": f"Describe a real project where you used {subject}. What problem were you solving and what decisions did you make?",
                    "hint": "Mention architecture, constraints, tools, and measurable outcomes.",
                },
                {
                    "id": f"{domain}-gap",
                    "domainId": domain,
                    "question": f"What is your biggest current gap in {title.lower()}, and how are you actively improving it?",
                    "hint": "Be specific about your limits, learning plan, and what better performance would look like.",
                },
            ]
        )
    return questions[:8]


def _count_hits(text: str, keywords: list[str]) -> int:
    lowered = text.lower()
    return sum(1 for keyword in keywords if keyword in lowered)


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9+\-#/.]{1,}", text.lower())


def _relevance_score(answer_text: str, domain: str, selected_skills: list[str], resume_keywords: set[str]) -> float:
    tokens = _tokenize(answer_text)
    if not tokens:
        return 0.0
    token_set = set(tokens)
    domain_tokens = {token for token in DOMAIN_KEYWORDS.get(domain, []) for token in _tokenize(token)}
    skill_tokens = _skill_tokens(selected_skills)
    resume_overlap = token_set.intersection(resume_keywords)

    domain_hits = len(token_set.intersection(domain_tokens))
    skill_hits = len(token_set.intersection(skill_tokens))
    resume_hits = len(resume_overlap)

    domain_component = min(domain_hits / 4, 1.0)
    skill_component = min(skill_hits / 4, 1.0)
    resume_component = min(resume_hits / 6, 1.0)
    return round((domain_component * 0.5) + (skill_component * 0.35) + (resume_component * 0.15), 3)


def _low_signal_score(answer_text: str) -> float:
    lowered = answer_text.lower().strip()
    if not lowered:
        return 1.0
    phrase_hits = sum(1 for phrase in LOW_SIGNAL_PHRASES if phrase in lowered)
    tokens = _tokenize(lowered)
    if not tokens:
        return 1.0
    unique_ratio = len(set(tokens)) / max(len(tokens), 1)
    repeated = max(0, len(tokens) - len(set(tokens)))
    filler_hits = sum(1 for token in tokens if token in FILLER_TOKENS)
    # closer to 1.0 => low signal / weak response
    raw = (
        (phrase_hits * 0.28)
        + (0.45 if len(tokens) < 18 else 0.0)
        + (0.25 if unique_ratio < 0.45 else 0.0)
        + min(0.18, repeated * 0.01)
        + min(0.16, filler_hits * 0.02)
    )
    return max(0.0, min(1.0, raw))


def _score_answer(answer_text: str, domain: str, selected_skills: list[str], resume_keywords: set[str]) -> float:
    lowered = answer_text.lower().strip()
    if not lowered:
        return 1.0

    words = _tokenize(lowered)
    word_count = len(words)
    length_score = min(word_count / 170, 1.0)
    evidence_hits = _count_hits(lowered, EVIDENCE_WORDS)
    tradeoff_hits = _count_hits(lowered, TRADEOFF_WORDS)
    outcome_hits = _count_hits(lowered, OUTCOME_WORDS)
    domain_hits = _count_hits(lowered, DOMAIN_KEYWORDS.get(domain, []))
    growth_hits = _count_hits(lowered, GAP_WORDS)
    relevance = _relevance_score(lowered, domain, selected_skills, resume_keywords)

    evidence_score = min(evidence_hits * 0.24, 1.0)
    tradeoff_score = min(tradeoff_hits * 0.22, 1.0)
    outcome_score = min(outcome_hits * 0.24, 1.0)
    domain_score = min(domain_hits * 0.15, 1.0)
    growth_score = min(growth_hits * 0.12, 0.8)
    low_signal = _low_signal_score(lowered)

    quality = (
        (length_score * 0.16)
        + (evidence_score * 0.22)
        + (tradeoff_score * 0.2)
        + (outcome_score * 0.2)
        + (domain_score * 0.1)
        + (growth_score * 0.04)
        + (relevance * 0.08)
    )
    penalized = max(0.0, quality - (low_signal * 0.8))
    raw = 1.0 + (penalized * 4.0)

    if word_count < 20:
        raw = min(raw, 2.0)
    if evidence_hits == 0 and outcome_hits == 0:
        raw = min(raw, 2.2)
    if low_signal >= 0.6:
        raw = min(raw, 1.7)
    if relevance < 0.18:
        raw = min(raw, 1.8)
    if relevance < 0.3 and (evidence_hits == 0 or outcome_hits == 0):
        raw = min(raw, 2.0)

    return round(max(1.0, min(5.0, raw)), 1)


def evaluate_interview(journey: dict, answers: list[dict], duration_minutes: int) -> dict:
    per_domain = []
    strengths = []
    gaps = []
    recommendations = []
    resume_analysis = journey.get("resumeAnalysis", {}) if isinstance(journey.get("resumeAnalysis"), dict) else {}
    resume_skills = resume_analysis.get("skills", []) if isinstance(resume_analysis.get("skills"), list) else []
    selected_skills = [str(skill).strip() for skill in [*(journey.get("skills", []) or []), *resume_skills] if str(skill).strip()]
    selected_skills = list(dict.fromkeys(selected_skills))
    profile = journey.get("profile", {})
    resume_keywords = _extract_resume_keywords(journey.get("resume", {}))
    if resume_skills:
        resume_keywords = resume_keywords.union(set(_tokenize(" ".join(resume_skills))))

    for domain in journey.get("domains", []):
        title = DOMAIN_TITLES.get(domain, domain)
        related_answers = [item for item in answers if item.get("domainId") == domain]
        joined = " ".join(item.get("answer", "") for item in related_answers).strip()
        answer_scores = [
            _score_answer(str(item.get("answer", "")), domain, selected_skills, resume_keywords)
            for item in related_answers
            if str(item.get("answer", "")).strip()
        ]
        score = round(sum(answer_scores) / max(len(answer_scores), 1), 1) if answer_scores else 1.0
        low_signal_answers = sum(
            1
            for item in related_answers
            if _low_signal_score(str(item.get("answer", ""))) >= 0.55
        )
        relevance = _relevance_score(joined, domain, selected_skills, resume_keywords)
        if len(related_answers) < 2:
            score = min(score, 2.4)
        if low_signal_answers >= 1:
            score = min(score, 2.0)
        if len(joined) < 90:
            score = min(score, 1.9)
        if relevance < 0.2:
            score = min(score, 1.8)
        mentioned_skills = [skill for skill in selected_skills if skill.lower() in joined.lower()]
        domain_strengths = []
        domain_gaps = []

        if _count_hits(joined, EVIDENCE_WORDS) >= 2:
            domain_strengths.append("Shows hands-on implementation evidence")
        if _count_hits(joined, TRADEOFF_WORDS) >= 2:
            domain_strengths.append("Explains technical judgment and tradeoffs clearly")
        if _count_hits(joined, OUTCOME_WORDS) >= 2:
            domain_strengths.append("Connects work to measurable outcomes")
        if len(mentioned_skills) >= 2:
            domain_strengths.append(f"Demonstrates relevant skills: {', '.join(mentioned_skills[:3])}")

        if len(joined) < 120:
            domain_gaps.append("Needs more implementation depth and specifics")
        if _count_hits(joined, TRADEOFF_WORDS) == 0:
            domain_gaps.append("Tradeoffs and decision-making are not clearly explained")
        if _count_hits(joined, OUTCOME_WORDS) == 0:
            domain_gaps.append("Lacks measurable impact or outcome framing")
        if relevance < 0.25:
            domain_gaps.append("Answer appears weakly aligned with the selected domain or stated skills")
        if low_signal_answers >= 1 or _low_signal_score(joined) >= 0.55:
            domain_gaps.append("Response quality appears low-signal or non-technical")
        if len(related_answers) < 2:
            domain_gaps.append("Insufficient answer coverage for this domain")

        gap_level = "Low" if score >= 4.3 else "Medium" if score >= 3.3 else "High"
        per_domain.append(
            {
                "id": domain,
                "title": title,
                "score": score,
                "gapLevel": gap_level,
                "strengths": domain_strengths[:3],
                "concerns": domain_gaps[:3],
                "evidence": mentioned_skills[:4],
            }
        )

        if domain_strengths:
            strengths.append(f"{title}: {domain_strengths[0]}")
        if domain_gaps:
            gaps.append(f"{title}: {domain_gaps[0]}")
            recommendations.append(f"Improve {title.lower()} by preparing one project story with architecture choices, debugging details, and measurable impact.")

    base_average = sum(item["score"] for item in per_domain) / max(len(per_domain), 1)
    profile_bonus, profile_strengths, profile_gaps, profile_recommendations, profile_highlights = _profile_signal(profile, selected_skills)
    average_score = round(max(1.0, min(5.0, base_average + profile_bonus)), 1)
    low_domains = len([item for item in per_domain if item["score"] < 2.4])
    if low_domains >= 1:
        average_score = min(average_score, 2.6)
    best_domain = max(per_domain, key=lambda item: item["score"], default={"title": "General engineering"})
    weakest_domain = min(per_domain, key=lambda item: item["score"], default={"title": "Technical depth"})
    weakest_title = weakest_domain["title"] if gaps else "No major gap detected"

    if average_score >= 4.6:
        hiring_signal = "Excellent"
    elif average_score >= 4.2:
        hiring_signal = "Strong"
    elif average_score >= 3.9:
        hiring_signal = "Promising"
    else:
        hiring_signal = "Needs Development"

    confidence = "High" if len(answers) >= 6 and duration_minutes >= 10 and profile_bonus >= 0.1 and average_score >= 4.1 else "Medium"
    if average_score < 2.8:
        confidence = "Low"
    employee_name = profile.get("fullName") or "Employee Candidate"
    strengths.extend(profile_strengths)
    gaps.extend(profile_gaps)
    recommendations.extend(profile_recommendations)

    return {
        "id": f"INT-{uuid4().hex[:10].upper()}",
        "source": "employee-interview",
        "title": f"{best_domain['title']} Interview",
        "employee": employee_name,
        "employeeId": journey.get("profile", {}).get("employeeId"),
        "status": "completed",
        "score": average_score,
        "date": datetime.now(UTC).isoformat(),
        "duration": f"{duration_minutes} min",
        "interviewer": "AI Technical Interviewer",
        "focusArea": best_domain["title"],
        "summary": f"{employee_name} shows strongest readiness in {best_domain['title']} and the biggest current gap in {weakest_title}. The evaluation weighs implementation evidence, decision quality, impact, response quality, integrity checks, and profile completeness.",
        "highlights": [
            f"Top strength: {best_domain['title']}",
            f"Primary gap: {weakest_title}",
            f"Hiring signal: {hiring_signal}",
            *profile_highlights,
        ][:5],
        "perDomain": per_domain,
        "answers": answers,
        "profile": profile,
        "resume": journey.get("resume", {}),
        "selectedSkills": selected_skills,
        "strengths": strengths[:5],
        "gaps": gaps[:5],
        "recommendations": recommendations[:5] or ["Add more quantified examples and explain technical tradeoffs more explicitly."],
        "hiringSignal": hiring_signal,
        "confidence": confidence,
        "evaluationMethod": "backend-heuristic",
    }
