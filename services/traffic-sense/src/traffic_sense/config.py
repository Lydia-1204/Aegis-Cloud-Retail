import os


def _split_addrs(raw: str, default: str) -> list[str]:
    value = raw.strip() if raw else default
    addrs = [item.strip() for item in value.split(",") if item.strip()]
    return addrs or [default]


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
    return go_store_business_addrs()[0]


def go_store_business_addrs() -> list[str]:
    return _split_addrs(
        os.getenv("GO_STORE_BUSINESS_ADDRS") or os.getenv("GO_STORE_BUSINESS_ADDR", ""),
        "localhost:50055",
    )


def cors_allow_origins() -> list[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS", "").strip()
    if raw:
        return [item.strip() for item in raw.split(",") if item.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]
