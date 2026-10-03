import os
import secrets
import random
import logging
from datetime import datetime, timezone, timedelta
import models
import schemas
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import engine, get_db, DATABASE_URL
from auth import hash_password, verify_password, generate_code, generate_token, verify_token, code_expiry
from mailer import send_code_email

logger = logging.getLogger("tests")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

_db_type = "postgresql" if "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL else "sqlite"
# print(f"[STARTUP] Database type: {_db_type}")
# print(f"[STARTUP] DATABASE_URL set: {bool(DATABASE_URL and 'neon' in DATABASE_URL)}")
logger.info(f"Database type: {_db_type}")
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tests API")

def _aware(dt: datetime) -> datetime:
    if dt is None:
        return datetime.min.replace(tzinfo=timezone.utc)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Не авторизован")
    payload = verify_token(authorization[7:])
    if not payload:
        raise HTTPException(status_code=401, detail="Токен истёк или недействителен")
    user = db.query(models.User).filter(models.User.login == payload["login"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user

_cors_env = os.environ.get("CORS_ORIGINS", "").strip()
_origins = [o.strip() for o in _cors_env.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=bool(_origins),   # credentials только при явных доменах
    allow_methods=["*"],
    allow_headers=["*"],
)

def pick_questions(test: models.Test) -> list:
    """Возвращает список вопросов для прохождения.
    Если random_count > 0 — случайная выборка такого размера,
    иначе — все вопросы (при shuffle_questions — перемешанные)."""
    raw = test.questions
    questions = list(raw) if isinstance(raw, list) else []
    n = test.random_count or 0

    if n >= len(questions):
        # берём все — но при shuffle_questions всё равно перемешаем
        if test.shuffle_questions:
            random.shuffle(questions)
        return questions

    if n > 0:
        return random.sample(questions, n)

    if test.shuffle_questions:
        random.shuffle(questions)
    return questions

def _to_out(test: models.Test) -> dict:
    return {
        "id": test.id,
        "owner": test.owner,
        "title": test.title,
        "type": test.type,
        "questions": test.questions,
        "shareCode": test.share_code,
        "timeLimit": test.time_limit or 0,
        "shuffleQuestions": test.shuffle_questions or False,
        "folder": test.folder or "",
        "randomCount": test.random_count or 0,
        "submissions": [
            {
                "id": s.id,
                "name": s.name,
                "score": s.score,
                "total": s.total,
                "answered": s.answered,
                "skipped": s.skipped,
                "detailed": s.detailed,
                "at": s.at,
            }
            for s in test.submissions
        ],
    }


@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/db-check")
def db_check(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT 1")).fetchone()
        user_count = db.query(models.User).count()
        test_count = db.query(models.Test).count()
        return {"connection": "ok"}
    except Exception:
        logger.exception("db-check failed")
        return {"db_type": _db_type, "connection": "fail"}

@app.get("/tests")
def get_tests(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tests = db.query(models.Test).filter(models.Test.owner == user.login).all()
    return [_to_out(t) for t in tests]


@app.get("/tests/by-code/{code}")
def get_test_by_code(code: str, db: Session = Depends(get_db)):
    test = db.query(models.Test).filter(models.Test.share_code == code).first()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")

    result = _to_out(test)
    result["questions"] = pick_questions(test)   # ← подменяем на выборку
    result["submissions"] = []    # гостю не показываем результаты других
    return result


@app.post("/tests")
def create_test(
    data: schemas.TestCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    code = secrets.token_hex(5).upper()
    test = models.Test(
        owner=user.login,
        title=data.title,
        type=data.type,
        questions=data.questions,
        share_code=code,
        time_limit=data.time_limit,
        shuffle_questions=data.shuffle_questions,
        folder=data.folder,
        random_count=data.random_count,
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    return _to_out(test)


@app.delete("/tests/{test_id}")
def delete_test(test_id: int, user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    test = db.query(models.Test).filter(
        models.Test.id == test_id,
        models.Test.owner == user.login,
    ).first()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    db.delete(test)
    db.commit()
    return {"deleted": True}


@app.put("/tests/{test_id}")
def update_test(
    test_id: int,
    data: schemas.TestCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.query(models.Test).filter(
        models.Test.id == test_id,
        models.Test.owner == user.login,
    ).first()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")
    test.title = data.title
    test.type = data.type
    test.questions = data.questions
    test.time_limit = data.time_limit
    test.shuffle_questions = data.shuffle_questions
    test.folder = data.folder
    test.random_count = data.random_count
    db.commit()
    db.refresh(test)
    return _to_out(test)


@app.post("/tests/{test_id}/submissions")
def add_submission(
    test_id: int,
    data: schemas.SubmissionCreate,
    db: Session = Depends(get_db),
):
    test = db.query(models.Test).filter(models.Test.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")

    # набор вопросов, которые реально были у клиента
    by_qid = {d.get("qid"): d for d in (data.detailed or [])}
    bank = {q["id"]: q for q in (test.questions or []) if isinstance(q, dict) and "id" in q}
    served = [bank[qid] for qid in by_qid.keys() if qid in bank]

    total = len(served)
    score = 0
    answered = 0

    if test.type == "quiz":
        for q in served:
            d = by_qid.get(q["id"]) or {}
            fmt = q.get("format")

            if fmt == "text":
                has = bool((d.get("text") or "").strip())
                ok = (d.get("text") or "").strip().lower() == (q.get("correctText") or "").strip().lower()
            elif fmt == "match":
                has = bool(d.get("matches"))
                pairs = q.get("pairs") or []
                ok = len(pairs) > 0 and all((d.get("matches") or {}).get(str(p["id"])) == p["id"] for p in pairs)
            elif fmt == "order":
                has = bool(d.get("orderItems"))
                correct = [i["id"] for i in (q.get("orderItems") or [])]
                user_ids = [i["id"] for i in (d.get("orderItems") or [])]
                ok = correct == user_ids
            else:  # single / multiple
                has = bool(d.get("selected"))
                correct = sorted(o["id"] for o in (q.get("options") or []) if o.get("correct"))
                sel = sorted(d.get("selected") or [])
                ok = correct == sel

            if has:
                answered += 1
            if ok:
                score += 1
    else:
        # для survey/analytics просто считаем отвеченные
        for q in served:
            d = by_qid.get(q["id"]) or {}
            fmt = q.get("format")
            if fmt in ("text", "match", "order"):
                has = bool(d.get(fmt if fmt != "match" else "matches") or d.get("orderItems") or d.get("text"))
            else:
                has = bool(d.get("selected"))
            if has:
                answered += 1

    sub = models.Submission(
        test_id=test_id,
        name=(data.name or "")[:100],
        score=score,
        total=total,
        answered=answered,
        skipped=total - answered,
        detailed=data.detailed,
        at=data.at,
    )

    db.add(sub)
    db.commit()
    db.refresh(test)
    result = _to_out(test)
    result["submissions"] = []   # не раскрываем чужие ответы гостю
    return result


@app.delete("/tests/{test_id}/submissions/{sub_id}")
def delete_submission(
    test_id: int,
    sub_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    test = db.query(models.Test).filter(
        models.Test.id == test_id,
        models.Test.owner == user.login,
    ).first()
    if not test:
        raise HTTPException(status_code=404, detail="Тест не найден")

    sub = (
        db.query(models.Submission)
        .filter(models.Submission.id == sub_id, models.Submission.test_id == test_id)
        .first()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Прохождение не найдено")

    db.delete(sub)
    db.commit()
    db.refresh(test)
    return _to_out(test)


# ==================== АВТОРИЗАЦИЯ ====================

# Шаг 1 регистрации: проверяем данные и шлём код на почту
@app.post("/auth/register/start")
def register_start(data: schemas.RegisterStart, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    login = data.login.strip()

    recent = db.query(models.EmailCode).filter(
        models.EmailCode.email == email,
        models.EmailCode.purpose == "register",
        models.EmailCode.created_at > datetime.now(timezone.utc) - timedelta(minutes=3),
    ).first()
    if recent:
        raise HTTPException(status_code=429, detail="Слишком часто. Подождите 3 минуты.")

    # Проверяем email и логин раздельно, чтобы не пропустить оба конфликта
    email_user = db.query(models.User).filter(models.User.email == email).first()
    login_user = db.query(models.User).filter(models.User.login == login).first()

    if email_user and email_user.is_verified:
        raise HTTPException(status_code=400, detail="Эта почта уже зарегистрирована")
    if login_user and login_user.is_verified:
        raise HTTPException(status_code=400, detail="Этот логин уже занят")

    # Удаляем устаревшие неподтверждённые записи, чтобы не нарушать уникальность
    if email_user:
        db.delete(email_user)
    if login_user and login_user is not email_user:
        db.delete(login_user)

    db.query(models.EmailCode).filter(
        models.EmailCode.email == email,
        models.EmailCode.purpose == "register",
    ).delete(synchronize_session=False)

    user = models.User(
        email=email,
        login=login,
        password_hash=hash_password(data.password),
        is_verified=False,
    )
    db.add(user)

    code = generate_code()
    db.add(models.EmailCode(
        email=email, code=code, purpose="register", expires_at=code_expiry(),
    ))
    db.commit()

    ok = send_code_email(email, code, "register")
    if not ok:
        db.query(models.EmailCode).filter(
            models.EmailCode.email == email,
            models.EmailCode.purpose == "register",
        ).delete(synchronize_session=False)
        db.delete(user)
        db.commit()
        raise HTTPException(status_code=502, detail="Не удалось отправить письмо. Попробуйте позже.")

    return {"sent": True}


# Шаг 2 регистрации: подтверждаем код
@app.post("/auth/register/confirm")
def register_confirm(data: schemas.CodeConfirm, db: Session = Depends(get_db)):
    email = data.email.strip().lower()

    rec = db.query(models.EmailCode).filter(
        models.EmailCode.email == email,
        models.EmailCode.purpose == "register",
    ).order_by(models.EmailCode.id.desc()).first()

    if not rec or rec.code != data.code.strip():
        raise HTTPException(status_code=400, detail="Неверный код")
    if _aware(rec.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Код истёк, запросите новый")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Пользователь не найден")

    user.is_verified = True
    db.commit()

    db.query(models.EmailCode).filter(
        models.EmailCode.email == email,
        models.EmailCode.purpose == "register",
    ).delete(synchronize_session=False)
    db.commit()

    token = generate_token(user.login, user.email)
    return {"token": token, "login": user.login, "email": user.email}


# Вход по логину ИЛИ email + пароль
@app.post("/auth/login")
def login(data: schemas.LoginInput, db: Session = Depends(get_db)):
    ident = data.login.strip()
    user = db.query(models.User).filter(
        (models.User.login == ident) | (models.User.email == ident.lower())
    ).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")
    if not user.is_verified:
        raise HTTPException(status_code=400, detail="Почта не подтверждена")

    token = generate_token(user.login, user.email)
    return {"token": token, "login": user.login, "email": user.email}


# Шаг 1 восстановления: шлём код на почту
@app.post("/auth/reset/start")
def reset_start(data: schemas.ResetStart, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    recent = db.query(models.EmailCode).filter(
        models.EmailCode.email == email,
        models.EmailCode.purpose == "reset",
        models.EmailCode.created_at > datetime.now(timezone.utc) - timedelta(minutes=3),
    ).first()
    if recent:
        raise HTTPException(status_code=429, detail="Слишком часто. Подождите 3 минуты.")

    if user and user.is_verified:
        db.query(models.EmailCode).filter(
            models.EmailCode.email == email,
            models.EmailCode.purpose == "reset",
        ).delete(synchronize_session=False)
        db.commit()

        code = generate_code()
        db.add(models.EmailCode(
            email=email, code=code, purpose="reset", expires_at=code_expiry(),
        ))
        db.commit()
        send_code_email(email, code, "reset")

    return {"sent": True}


# Шаг 2 восстановления: подтверждаем код и ставим новый пароль
@app.post("/auth/reset/confirm")
def reset_confirm(data: schemas.ResetConfirm, db: Session = Depends(get_db)):
    email = data.email.strip().lower()

    rec = db.query(models.EmailCode).filter(
        models.EmailCode.email == email,
        models.EmailCode.purpose == "reset",
    ).order_by(models.EmailCode.id.desc()).first()

    if not rec or rec.code != data.code.strip():
        raise HTTPException(status_code=400, detail="Неверный код")
    if _aware(rec.expires_at) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Код истёк, запросите новый")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="Пользователь не найден")

    user.password_hash = hash_password(data.new_password)
    db.commit()

    db.query(models.EmailCode).filter(
        models.EmailCode.email == email,
        models.EmailCode.purpose == "reset",
    ).delete(synchronize_session=False)
    db.commit()

    token = generate_token(user.login, user.email)
    return {"token": token, "login": user.login, "email": user.email}


# Напомнить логин по почте
@app.post("/auth/forgot-login")
def forgot_login(data: schemas.ResetStart, db: Session = Depends(get_db)):
    email = data.email.strip().lower()

    recent = db.query(models.EmailCode).filter(
        models.EmailCode.email == email,
        models.EmailCode.purpose == "login_reminder",
        models.EmailCode.created_at > datetime.now(timezone.utc) - timedelta(minutes=3),
    ).first()
    if recent:
        raise HTTPException(status_code=429, detail="Слишком часто. Подождите 3 минуты.")

    user = db.query(models.User).filter(models.User.email == email).first()
    if user and user.is_verified:
        db.add(models.EmailCode(
            email=email,
            code="",
            purpose="login_reminder",
            expires_at=code_expiry(),
        ))
        db.commit()
        send_code_email(email, f"Ваш логин: {user.login}", "login_reminder")
    return {"sent": True}