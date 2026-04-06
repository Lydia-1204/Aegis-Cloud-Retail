import os


def database_url() -> str:
    """与 ai-assistant 共用 PostgreSQL 库 aegis_python；由 PYTHON_DATABASE_URL 注入。"""
    return os.getenv("PYTHON_DATABASE_URL", "").strip()
