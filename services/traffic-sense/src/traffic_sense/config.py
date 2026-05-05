import os


def _get_default_database_url() -> str:
    env = os.getenv("ENV", "development")
    if env == "production":
        return os.getenv("PYTHON_DATABASE_URL", "").strip()
    return os.getenv(
        "PYTHON_DATABASE_URL",
        "postgresql+asyncpg://postgres:123456@localhost:5432/aegis_python"
    ).strip()


def database_url() -> str:
    return _get_default_database_url()


def go_store_business_addr() -> str:
    return os.getenv("GO_STORE_BUSINESS_ADDR", "localhost:50055").strip()
