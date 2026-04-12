from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


def check_database_ready(db_dsn: str) -> tuple[bool, str | None]:
    try:
        engine = create_engine(db_dsn, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True, None
    except SQLAlchemyError as exc:
        return False, str(exc)
