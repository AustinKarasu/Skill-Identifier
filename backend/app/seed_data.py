from __future__ import annotations

import hashlib


def hash_password(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


DEFAULT_SETTINGS = {
    "profile": {
        "name": "",
        "email": "",
        "title": "",
        "phone": "",
        "department": "",
        "manager": "",
        "photoData": "",
    },
    "preferences": {
        "emailAlerts": True,
        "assessmentNotifications": True,
        "weeklyReport": True,
        "pushNotifications": True,
    },
    "localization": {
        "language": "en",
        "timezone": "UTC",
        "dateFormat": "MM/DD/YYYY",
    },
    "privacy": {
        "profileVisibility": "everyone",
        "shareAssessments": True,
        "shareSkills": True,
        "allowTracking": True,
    },
    "security": {
        "twoFactorRequired": True,
        "sessionTimeoutMinutes": 60,
        "lastPasswordChange": "",
    },
    "appearance": {
        "theme": "dark",
        "accentColor": "White",
        "fontSize": "Normal",
    },
}

DEFAULT_EMPLOYEE_JOURNEY = {
    "profile": {
        "fullName": "",
        "email": "",
        "employeeId": "",
        "role": "",
        "department": "",
        "experienceLevel": "Mid-level",
        "yearsExperience": "",
        "location": "",
        "portfolioUrl": "",
        "githubUrl": "",
        "linkedinUrl": "",
        "photoData": "",
        "summary": "",
    },
    "resume": {"fileName": "", "uploadedAt": "", "fileSize": 0, "contentType": "", "fileData": ""},
    "jobDescription": "",
    "jobMatchAnalysis": {},
    "jobMatchAnalyzedAt": "",
    "domains": [],
    "skills": [],
    "interviewReady": False,
    "latestResultId": None,
}

DEFAULT_EMPLOYEES = [
    {
        "name": "Aarush Sharma",
        "email": "employee@company.com",
        "role": "Backend Developer",
        "skills": ["Python", "FastAPI", "PostgreSQL", "System Design"],
        "skillLevel": 3.8,
        "status": "active",
        "lastAssessment": "2026-03-22",
    },
    {
        "name": "Isha Verma",
        "email": "isha.verma@company.com",
        "role": "Frontend Developer",
        "skills": ["React", "TypeScript", "Tailwind CSS", "Accessibility"],
        "skillLevel": 4.2,
        "status": "active",
        "lastAssessment": "2026-03-21",
    },
    {
        "name": "Rohan Kapoor",
        "email": "rohan.kapoor@company.com",
        "role": "Data Analyst",
        "skills": ["SQL", "Python", "Power BI", "Statistics"],
        "skillLevel": 3.5,
        "status": "pending",
        "lastAssessment": "2026-03-18",
    },
    {
        "name": "Neha Joshi",
        "email": "neha.joshi@company.com",
        "role": "DevOps Engineer",
        "skills": ["Docker", "Kubernetes", "CI/CD", "AWS"],
        "skillLevel": 3.9,
        "status": "active",
        "lastAssessment": "2026-03-20",
    },
]

DEFAULT_ROLES = [
    {
        "name": "Backend Developer",
        "requiredSkills": ["Python", "FastAPI", "PostgreSQL", "API Design"],
        "employees": 2,
        "avgScore": 3.9,
        "readiness": "On Track",
        "topGap": "Advanced query optimization",
        "lastReview": "2026-03-22",
    },
    {
        "name": "Frontend Developer",
        "requiredSkills": ["React", "TypeScript", "Testing", "Accessibility"],
        "employees": 2,
        "avgScore": 4.1,
        "readiness": "Strong",
        "topGap": "End-to-end test depth",
        "lastReview": "2026-03-21",
    },
    {
        "name": "DevOps Engineer",
        "requiredSkills": ["CI/CD", "Docker", "Kubernetes", "Monitoring"],
        "employees": 1,
        "avgScore": 3.8,
        "readiness": "On Track",
        "topGap": "Incident runbook coverage",
        "lastReview": "2026-03-20",
    },
]

DEFAULT_RUBRICS = [
    {
        "name": "Backend Fundamentals Rubric",
        "description": "Evaluates API architecture, data handling, and reliability decisions.",
        "competencies": [
            {"name": "API Design", "weight": 4, "description": "Designs clear, scalable endpoints."},
            {"name": "Database Thinking", "weight": 4, "description": "Models data and queries efficiently."},
            {"name": "Reliability", "weight": 3, "description": "Covers errors, validation, and edge cases."},
        ],
    },
    {
        "name": "Frontend Delivery Rubric",
        "description": "Measures UI quality, state management, and user-centric implementation.",
        "competencies": [
            {"name": "Component Design", "weight": 4, "description": "Builds maintainable reusable UI."},
            {"name": "State Management", "weight": 3, "description": "Handles async and local state cleanly."},
            {"name": "UX Quality", "weight": 3, "description": "Delivers responsive and accessible UX."},
        ],
    },
]

DEFAULT_ASSESSMENT_TEMPLATES = [
    {
        "title": "Backend SQL + API Assessment",
        "description": "Role-focused backend check for API and relational database fundamentals.",
        "category": "backend",
        "rubricName": "Backend Fundamentals Rubric",
        "questions": [
            {
                "id": "q1",
                "type": "mcq",
                "prompt": "Which HTTP method is most suitable for idempotent partial updates?",
                "options": ["POST", "PATCH", "PUT", "DELETE"],
                "correctIndex": 2,
                "keywords": [],
            },
            {
                "id": "q2",
                "type": "mcq",
                "prompt": "What is the main benefit of adding an index on a frequently filtered column?",
                "options": ["Lower disk usage", "Faster read queries", "Automatic backups", "Smaller transactions"],
                "correctIndex": 1,
                "keywords": [],
            },
            {
                "id": "q3",
                "type": "text",
                "prompt": "How would you prevent N+1 query problems in an API endpoint?",
                "options": [],
                "correctIndex": 0,
                "keywords": ["join", "eager", "prefetch", "batch"],
            },
        ],
    },
    {
        "title": "Frontend React Delivery Assessment",
        "description": "Assesses practical React implementation and performance-aware UI decisions.",
        "category": "frontend",
        "rubricName": "Frontend Delivery Rubric",
        "questions": [
            {
                "id": "q1",
                "type": "mcq",
                "prompt": "What hook should be used to memoize expensive computed values?",
                "options": ["useEffect", "useReducer", "useMemo", "useRef"],
                "correctIndex": 2,
                "keywords": [],
            },
            {
                "id": "q2",
                "type": "mcq",
                "prompt": "Which approach best avoids unnecessary list re-renders in React?",
                "options": ["Using random keys", "Stable keys and memoized child items", "Mutating props in place", "Using global variables"],
                "correctIndex": 1,
                "keywords": [],
            },
            {
                "id": "q3",
                "type": "text",
                "prompt": "Name two ways to improve mobile UX in a data-heavy dashboard.",
                "options": [],
                "correctIndex": 0,
                "keywords": ["responsive", "lazy", "pagination", "touch", "a11y"],
            },
        ],
    },
]

DEFAULT_STORE = {
    "users": [
        {
            "id": "mgr-1",
            "email": "manager@company.com",
            "role": "manager",
            "fullName": "Manager Account",
            "department": "Leadership",
            "passwordHash": hash_password("manager123"),
        },
        {
            "id": "EMP-1001",
            "email": "employee@company.com",
            "role": "employee",
            "fullName": "Aarush Sharma",
            "department": "Engineering",
            "passwordHash": hash_password("employee123"),
        },
    ],
    "notifications": [],
    "employees": DEFAULT_EMPLOYEES,
    "roles": DEFAULT_ROLES,
    "assessments": [],
    "dashboard": {
        "skillGapData": [],
        "skillDistribution": [],
        "activity": [],
    },
    "reports": {"trendData": [], "skillReport": []},
    "leaderboard": {
        "topPerformers": [],
        "leaderboard": [],
        "skillLeaders": [],
        "achievements": [],
    },
    "employeeJourney": DEFAULT_EMPLOYEE_JOURNEY,
}
