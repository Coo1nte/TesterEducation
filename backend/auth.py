import random
import secrets
import jwt
import os
from datetime import datetime, timedelta
from passlib.context import CryptContext

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-key-change-in-prod")
JWT_EXPIRY_HOURS = 72

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


def generate_code() -> str:
    # 6-значный код, например "047382"
    return f"{random.randint(0, 999999):06d}"


def generate_token(login: str, email: str) -> str:
    payload = {
        "login": login,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None


def code_expiry() -> datetime:
    # код живёт 10 минут
    return datetime.utcnow() + timedelta(minutes=10)
