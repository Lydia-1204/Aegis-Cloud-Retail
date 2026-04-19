import os
from jose import JWTError, jwt
from typing import Optional, Dict, Any


def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """验证JWT token并返回payload"""
    secret_key = os.getenv("JWT_SECRET", "your-secret-key")
    if not secret_key:
        return None

    try:
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        return payload
    except JWTError:
        return None
