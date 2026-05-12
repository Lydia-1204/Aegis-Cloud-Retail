import os
from jose import JWTError, jwt
from typing import Optional, Dict, Any


def _jwt_secret() -> str:
    return (
        os.getenv("JWT_SECRET")
        or os.getenv("FOUNDATION_DATA_JWT_SECRET")
        or "foundation-data-dev-secret"
    ).strip()


def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """验证JWT token并返回payload"""
    secret_key = _jwt_secret()
    if not secret_key:
        return None

    try:
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        return payload
    except JWTError:
        return None
