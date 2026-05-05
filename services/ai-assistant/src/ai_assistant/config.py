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


def deepseek_api_key() -> str:
    return os.getenv("DEEPSEEK_API_KEY", "").strip()


def deepseek_base_url() -> str:
    return os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").strip()


def go_basic_data_addr() -> str:
    return os.getenv("GO_BASIC_DATA_ADDR", "localhost:50054").strip()


def go_store_business_addr() -> str:
    return os.getenv("GO_STORE_BUSINESS_ADDR", "localhost:50055").strip()
