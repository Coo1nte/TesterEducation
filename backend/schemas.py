from pydantic import BaseModel, EmailStr, field_validator
from typing import Any, List
import re


class SubmissionCreate(BaseModel):
    name: str
    score: int = 0
    total: int = 0
    answered: int = 0
    skipped: int = 0
    detailed: Any = []
    at: str


class SubmissionOut(SubmissionCreate):
    id: int

    class Config:
        from_attributes = True


class TestCreate(BaseModel):
    owner: str
    title: str
    type: str
    questions: Any
    time_limit: int = 0
    shuffle_questions: bool = False
    folder: str = ""
    random_count: int = 0


class TestOut(BaseModel):
    id: int
    owner: str
    title: str
    type: str
    questions: Any
    shareCode: str
    timeLimit: int = 0
    shuffleQuestions: bool = False
    folder: str = ""
    submissions: List[SubmissionOut] = []

    class Config:
        from_attributes = True


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
    email: str
    code: str


class LoginInput(BaseModel):
    login: str  # сюда можно ввести логин ИЛИ email
    password: str


class ResetStart(BaseModel):
    email: str


class ResetConfirm(BaseModel):
    email: str
    code: str
    new_password: str


class AuthOut(BaseModel):
    token: str
    login: str
    email: str
