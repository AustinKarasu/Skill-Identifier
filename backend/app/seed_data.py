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
    "employees": [],
    "roles": [],
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
