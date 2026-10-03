from pydantic import BaseModel, EmailStr, field_validator, Field
from typing import Any, Dict, List, Literal
import re

class SubmissionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    score: int = 0
    total: int = 0
    answered: int = 0
    skipped: int = 0
    detailed: List[Dict[str, Any]] = Field(default_factory=list)
    at: str

class TestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    type: Literal["quiz", "survey", "analytics"]
    questions: List[Dict[str, Any]] = Field(default_factory=list)
    time_limit: int = 0
    shuffle_questions: bool = False
    folder: str = ""
    random_count: int = 0


# ---------- Авторизация ----------
class RegisterStart(BaseModel):
    email: EmailStr
    login: str
    password: str

    @field_validator('login')
    @classmethod
    def validate_login(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError('Логин минимум 3 символа')
        if len(v) > 30:
            raise ValueError('Логин не более 30 символов')
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Логин может содержать только латинские буквы, цифры и знак _')
        return v

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('Пароль минимум 6 символов')
        return v


class CodeConfirm(BaseModel):
    email: EmailStr
    code: str


class LoginInput(BaseModel):
    login: str  # сюда можно ввести логин ИЛИ email
    password: str


class ResetStart(BaseModel):
    email: EmailStr


class ResetConfirm(BaseModel):
    email: EmailStr
    code: str
    new_password: str
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError('Пароль минимум 6 символов')
        return v


class AuthOut(BaseModel):
    token: str
    login: str
    email: str
