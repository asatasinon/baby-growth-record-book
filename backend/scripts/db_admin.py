from __future__ import annotations

import argparse
from pathlib import Path
import sys

import psycopg

BACKEND_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_ROOT.parent
DEFAULT_SCHEMA_SQL = REPO_ROOT / "docs/specs/S02-db-schema.sql"
DEFAULT_SEED_SQL = REPO_ROOT / "docs/specs/S03-test-seed.sql"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings


def _connection() -> psycopg.Connection:
    settings = get_settings()
    return psycopg.connect(
        host=settings.db_host,
        port=settings.db_port,
        dbname=settings.db_name,
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


def run_init(schema_path: Path) -> None:
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

    init_parser = subparsers.add_parser("init", help="Reset public schema and apply baseline SQL.")
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
    if args.command == "init":
        run_init(args.schema_file)
        return
    if args.command == "seed":
        run_seed(args.seed_file)
        return
    raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
