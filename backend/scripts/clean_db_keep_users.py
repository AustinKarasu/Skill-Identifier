from __future__ import annotations

from sqlalchemy import delete

from app.database import (
    AppStateRecord,
    AssessmentRecord,
    EmployeeRecord,
    NotificationRecord,
    RoleRecord,
    SettingsRecord,
    UserRecord,
    db_session,
    seed_if_empty,
)
from app.seed_data import DEFAULT_STORE

TABLES_IN_DELETE_ORDER = [
    NotificationRecord,
    EmployeeRecord,
    RoleRecord,
    AssessmentRecord,
    AppStateRecord,
    SettingsRecord,
    UserRecord,
]


def reset_database_keep_minimal_users() -> None:
    with db_session() as session:
        for model in TABLES_IN_DELETE_ORDER:
            session.execute(delete(model))
        seed_if_empty(session, DEFAULT_STORE)


if __name__ == "__main__":
    reset_database_keep_minimal_users()
    print("Database reset complete. Seeded manager and employee users only.")
