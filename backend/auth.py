import secrets
import jwt
import os
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET не задан. Установите переменную окружения.")
JWT_EXPIRY_HOURS = 72
CODE_TTL_MINUTES = int(os.environ.get("CODE_TTL_MINUTES", "10"))

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
    return f"{secrets.randbelow(1_000_000):06d}"

def generate_token(login: str, email: str) -> str:
    payload = {
        "login": login,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def verify_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except (ExpiredSignatureError, InvalidTokenError):
        return None

def code_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=CODE_TTL_MINUTES)