from __future__ import annotations

import json
from contextlib import contextmanager
from copy import deepcopy
from typing import Any

from sqlalchemy import Boolean, Float, Integer, String, Text, create_engine, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from .config import DATABASE_URL
from .seed_data import DEFAULT_EMPLOYEE_JOURNEY, DEFAULT_SETTINGS, DEFAULT_STORE


class Base(DeclarativeBase):
    pass


class UserRecord(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)


class NotificationRecord(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    time_label: Mapped[str] = mapped_column(String(255), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    category: Mapped[str | None] = mapped_column(String(32), nullable=True)


class SettingsRecord(Base):
    __tablename__ = "settings"
    section: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)


class EmployeeRecord(Base):
    __tablename__ = "employees"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False)
    skills_json: Mapped[str] = mapped_column(Text, nullable=False)
    skill_level: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    last_assessment: Mapped[str] = mapped_column(String(255), nullable=False)


class RoleRecord(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    required_skills_json: Mapped[str] = mapped_column(Text, nullable=False)
    employees: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    avg_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    readiness: Mapped[str] = mapped_column(String(64), nullable=False)
    top_gap: Mapped[str] = mapped_column(String(255), nullable=False)
    last_review: Mapped[str] = mapped_column(String(64), nullable=False)


class AssessmentRecord(Base):
    __tablename__ = "assessments"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    source: Mapped[str] = mapped_column(String(64), default="seeded", nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    employee: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    date: Mapped[str] = mapped_column(String(64), nullable=False)
    duration: Mapped[str] = mapped_column(String(64), nullable=False)
    interviewer: Mapped[str] = mapped_column(String(255), nullable=False)
    focus_area: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    highlights_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    per_domain_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    answers_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    profile_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    resume_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    selected_skills_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    strengths_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    gaps_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    recommendations_json: Mapped[str] = mapped_column(Text, default="[]", nullable=False)
    hiring_signal: Mapped[str] = mapped_column(String(64), default="Pending", nullable=False)
    confidence: Mapped[str] = mapped_column(String(64), default="Medium", nullable=False)
    evaluation_method: Mapped[str] = mapped_column(String(64), default="backend-heuristic", nullable=False)
    share_token: Mapped[str | None] = mapped_column(String(80), nullable=True)
    share_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    share_created_at: Mapped[str | None] = mapped_column(String(64), nullable=True)


class AppStateRecord(Base):
    __tablename__ = "app_state"
    state_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[str] = mapped_column(Text, nullable=False)


class ManagerInterviewScheduleRecord(Base):
    __tablename__ = "manager_interview_schedules"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    employee_id: Mapped[str] = mapped_column(String(80), nullable=False)
    candidate_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    manager_id: Mapped[str] = mapped_column(String(80), nullable=False)
    manager_name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    meeting_mode: Mapped[str] = mapped_column(String(64), nullable=False, default="Virtual")
    location: Mapped[str] = mapped_column(Text, nullable=False, default="")
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    start_at: Mapped[str] = mapped_column(String(64), nullable=False)
    end_at: Mapped[str] = mapped_column(String(64), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=45)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled")
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)


class ManagerCommunicationRecord(Base):
    __tablename__ = "manager_communications"
    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    employee_id: Mapped[str] = mapped_column(String(80), nullable=False)
    candidate_name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    recipient: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    recipient_phone: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    delivery_status: Mapped[str] = mapped_column(String(64), nullable=False, default="recorded")
    launch_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sent_by: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)


class RubricTemplateRecord(Base):
    __tablename__ = "rubric_templates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    competencies_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)


class AssessmentTemplateRecord(Base):
    __tablename__ = "assessment_templates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(64), nullable=False, default="general")
    questions_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    rubric_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)


class AssessmentAttemptRecord(Base):
    __tablename__ = "assessment_attempts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    template_id: Mapped[int] = mapped_column(Integer, nullable=False)
    employee_id: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="started")
    started_at: Mapped[str] = mapped_column(String(64), nullable=False)
    submitted_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    answers_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    result_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")


class FeedbackSurveyRecord(Base):
    __tablename__ = "feedback_surveys"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    assessment_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    employee_id: Mapped[str] = mapped_column(String(80), nullable=False)
    responses_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    submitted_at: Mapped[str] = mapped_column(String(64), nullable=False)

ACTIVE_DATABASE_URL = DATABASE_URL
ACTIVE_DATABASE_MODE = "remote"


def build_engine(database_url: str):
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    engine_kwargs: dict[str, Any] = {"future": True, "pool_pre_ping": True, "connect_args": connect_args}
    if not database_url.startswith("sqlite"):
        engine_kwargs.update({"pool_size": 5, "max_overflow": 10, "pool_recycle": 1800})
    return create_engine(database_url, **engine_kwargs)


engine = build_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def dumps_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def loads_json(value: str | None, fallback: Any) -> Any:
    if not value:
        return deepcopy(fallback)
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return deepcopy(fallback)


@contextmanager
def db_session() -> Any:
    session = SessionLocal()
    try:
        session.execute(text("SELECT 1"))
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_state(session: Session, key: str, fallback: Any) -> Any:
    row = session.get(AppStateRecord, key)
    return loads_json(row.payload if row else None, fallback)


def set_state(session: Session, key: str, payload: Any) -> None:
    row = session.get(AppStateRecord, key)
    encoded = dumps_json(payload)
    if row:
        row.payload = encoded
    else:
        session.add(AppStateRecord(state_key=key, payload=encoded))

def seed_if_empty(session: Session, seed: dict[str, Any]) -> None:
    if session.scalar(select(UserRecord.id).limit(1)) is not None:
        return

    for user in seed["users"]:
        session.add(UserRecord(id=user["id"], email=user["email"], role=user["role"], full_name=user["fullName"], department=user["department"], password_hash=user["passwordHash"]))

    for item in seed["notifications"]:
        session.add(NotificationRecord(title=item["title"], message=item["message"], time_label=item["time"], is_read=item["read"]))

    settings_payload = seed.get("settings", DEFAULT_SETTINGS)
    for section, payload in settings_payload.items():
        session.add(SettingsRecord(section=section, payload=dumps_json(payload)))

    for employee in seed["employees"]:
        session.add(EmployeeRecord(name=employee["name"], email=employee["email"], role=employee["role"], skills_json=dumps_json(employee["skills"]), skill_level=employee["skillLevel"], status=employee["status"], last_assessment=employee["lastAssessment"]))

    for role in seed["roles"]:
        session.add(RoleRecord(name=role["name"], required_skills_json=dumps_json(role["requiredSkills"]), employees=role["employees"], avg_score=role["avgScore"], readiness=role["readiness"], top_gap=role["topGap"], last_review=role["lastReview"]))

    for assessment in seed.get("assessments", []):
        session.add(AssessmentRecord(id=assessment["id"], source=assessment.get("source", "seeded"), title=assessment["title"], employee=assessment["employee"], employee_id=assessment.get("employeeId"), status=assessment["status"], score=float(assessment["score"]), date=assessment["date"], duration=assessment["duration"], interviewer=assessment["interviewer"], focus_area=assessment["focusArea"], summary=assessment["summary"], highlights_json=dumps_json(assessment.get("highlights", [])), per_domain_json=dumps_json(assessment.get("perDomain", [])), answers_json=dumps_json(assessment.get("answers", [])), profile_json=dumps_json(assessment.get("profile", {})), resume_json=dumps_json(assessment.get("resume", {})), selected_skills_json=dumps_json(assessment.get("selectedSkills", [])), strengths_json=dumps_json(assessment.get("strengths", [])), gaps_json=dumps_json(assessment.get("gaps", [])), recommendations_json=dumps_json(assessment.get("recommendations", [])), hiring_signal=assessment.get("hiringSignal", "Pending"), confidence=assessment.get("confidence", "Medium"), evaluation_method=assessment.get("evaluationMethod", "seeded")))

    set_state(session, "dashboard", seed.get("dashboard", {}))
    set_state(session, "reports", seed.get("reports", {}))
    set_state(session, "leaderboard", seed.get("leaderboard", {}))
    set_state(session, "employeeJourney", seed.get("employeeJourney", DEFAULT_EMPLOYEE_JOURNEY))

def get_database_mode() -> str:
    return ACTIVE_DATABASE_MODE


def init_database() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_assessment_share_columns()
    ensure_notification_columns()

    with db_session() as session:
        seed_if_empty(session, deepcopy(DEFAULT_STORE))


def ensure_assessment_share_columns() -> None:
    try:
        with engine.begin() as connection:
            if ACTIVE_DATABASE_URL.startswith("sqlite"):
                columns = [row[1] for row in connection.execute(text("PRAGMA table_info(assessments)")).fetchall()]
                if "share_token" not in columns:
                    connection.execute(text("ALTER TABLE assessments ADD COLUMN share_token VARCHAR(80)"))
                if "share_enabled" not in columns:
                    connection.execute(text("ALTER TABLE assessments ADD COLUMN share_enabled BOOLEAN NOT NULL DEFAULT 0"))
                if "share_created_at" not in columns:
                    connection.execute(text("ALTER TABLE assessments ADD COLUMN share_created_at VARCHAR(64)"))
            else:
                result = connection.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name='assessments'
                        """
                    )
                ).fetchall()
                columns = {row[0] for row in result}
                if "share_token" not in columns:
                    connection.execute(text("ALTER TABLE assessments ADD COLUMN share_token VARCHAR(80)"))
                if "share_enabled" not in columns:
                    connection.execute(text("ALTER TABLE assessments ADD COLUMN share_enabled BOOLEAN NOT NULL DEFAULT FALSE"))
                if "share_created_at" not in columns:
                    connection.execute(text("ALTER TABLE assessments ADD COLUMN share_created_at VARCHAR(64)"))
    except SQLAlchemyError:
        return


def ensure_notification_columns() -> None:
    try:
        with engine.begin() as connection:
            if ACTIVE_DATABASE_URL.startswith("sqlite"):
                columns = [row[1] for row in connection.execute(text("PRAGMA table_info(notifications)")).fetchall()]
                if "user_id" not in columns:
                    connection.execute(text("ALTER TABLE notifications ADD COLUMN user_id VARCHAR(80)"))
                if "created_at" not in columns:
                    connection.execute(text("ALTER TABLE notifications ADD COLUMN created_at VARCHAR(64)"))
                if "category" not in columns:
                    connection.execute(text("ALTER TABLE notifications ADD COLUMN category VARCHAR(32)"))
            else:
                result = connection.execute(
                    text(
                        """
                        SELECT column_name
                        FROM information_schema.columns
                        WHERE table_name='notifications'
                        """
                    )
                ).fetchall()
                columns = {row[0] for row in result}
                if "user_id" not in columns:
                    connection.execute(text("ALTER TABLE notifications ADD COLUMN user_id VARCHAR(80)"))
                if "created_at" not in columns:
                    connection.execute(text("ALTER TABLE notifications ADD COLUMN created_at VARCHAR(64)"))
                if "category" not in columns:
                    connection.execute(text("ALTER TABLE notifications ADD COLUMN category VARCHAR(32)"))
    except SQLAlchemyError:
        return
