from __future__ import annotations

import argparse
from pathlib import Path
import sys

import psycopg
from psycopg import sql

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
DEFAULT_SCHEMA_SQL = REPO_ROOT / "docs/specs/S02-db-schema.sql"
DEFAULT_SEED_SQL = REPO_ROOT / "docs/specs/S03-test-seed.sql"
DEFAULT_ADMIN_DB = "postgres"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings


def _connection(dbname: str | None = None) -> psycopg.Connection:
    settings = get_settings()
    return psycopg.connect(
        host=settings.db_host,
        port=settings.db_port,
        dbname=dbname or settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
        autocommit=True,
    )


def _read_sql_file(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"SQL file not found: {path}")
    sql = path.read_text(encoding="utf-8")
    if not sql.strip():
        raise ValueError(f"SQL file is empty: {path}")
    return sql


def run_create(admin_db: str) -> None:
    settings = get_settings()
    target_db = settings.db_name
    admin_candidates = [admin_db, "template1"]
    if target_db not in admin_candidates:
        admin_candidates.append(target_db)

    last_error: Exception | None = None
    for candidate in admin_candidates:
        try:
            with _connection(candidate) as conn:
                with conn.cursor() as cursor:
                    cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (target_db,))
                    exists = cursor.fetchone() is not None
                    if exists:
                        return
                    cursor.execute(
                        sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target_db))
                    )
                    return
        except Exception as exc:  # pragma: no cover - env-specific runtime failures
            last_error = exc
            continue

    if last_error is not None:
        raise RuntimeError(
            f"Unable to create database '{target_db}'. "
            f"Please verify connection and privilege, then create it manually."
        ) from last_error

    raise RuntimeError(f"Unable to create database '{target_db}'.")


def run_init(schema_path: Path, admin_db: str) -> None:
    run_create(admin_db)
    schema_sql = _read_sql_file(schema_path)
    with _connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("DROP SCHEMA IF EXISTS public CASCADE;")
            cursor.execute("CREATE SCHEMA public;")
            cursor.execute(schema_sql)


def run_seed(seed_path: Path) -> None:
    seed_sql = _read_sql_file(seed_path)
    with _connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(seed_sql)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Database admin helper for local scripts.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser(
        "create", help="Create target database if it does not exist."
    )
    create_parser.add_argument(
        "--admin-db",
        type=str,
        default=DEFAULT_ADMIN_DB,
        help=f"Database used for admin connection (default: {DEFAULT_ADMIN_DB})",
    )

    init_parser = subparsers.add_parser("init", help="Reset public schema and apply baseline SQL.")
    init_parser.add_argument(
        "--admin-db",
        type=str,
        default=DEFAULT_ADMIN_DB,
        help=f"Database used for admin connection (default: {DEFAULT_ADMIN_DB})",
    )
    init_parser.add_argument(
        "--schema-file",
        type=Path,
        default=DEFAULT_SCHEMA_SQL,
        help=f"Path to baseline schema SQL file (default: {DEFAULT_SCHEMA_SQL})",
    )

    seed_parser = subparsers.add_parser("seed", help="Apply seed SQL.")
    seed_parser.add_argument(
        "--seed-file",
        type=Path,
        default=DEFAULT_SEED_SQL,
        help=f"Path to seed SQL file (default: {DEFAULT_SEED_SQL})",
    )

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.command == "create":
        run_create(args.admin_db)
        return
    if args.command == "init":
        run_init(args.schema_file, args.admin_db)
        return
    if args.command == "seed":
        run_seed(args.seed_file)
        return
    raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
