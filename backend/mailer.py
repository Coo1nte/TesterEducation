import os
import smtplib
from email.mime.text import MIMEText
from email.header import Header

# Если EMAIL_ENABLED=false — код всегда печатается в лог, SMTP не трогаем
EMAIL_ENABLED = os.environ.get("EMAIL_ENABLED", "false").lower() == "true"

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.yandex.ru")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", SMTP_USER)
CODE_TTL_MINUTES = int(os.environ.get("CODE_TTL_MINUTES", "10"))


def _print_code(to_email: str, subject: str, body: str) -> None:
    print("=" * 50)
    print(f"[EMAIL -> {to_email}] {subject}")
    print(body)
    print("=" * 50)


def send_code_email(to_email: str, code_or_text: str, purpose: str) -> bool:
    if purpose == "login_reminder":
        subject = "Ваш логин"
        body = code_or_text
    elif purpose == "reset":
        subject = "Код для смены пароля"
        body = (
            f"Ваш код для смены пароля: {code_or_text}\n\n"
            f"Код действует {CODE_TTL_MINUTES} минут.\n"
            f"Если вы не запрашивали смену пароля — просто проигнорируйте письмо."
        )
    else:
        subject = "Код подтверждения регистрации"
        body = (
            f"Ваш код подтверждения: {code_or_text}\n\n"
            f"Введите его в приложении, чтобы завершить регистрацию.\n"
            f"Код действует {CODE_TTL_MINUTES} минут."
        )

    # Dev-режим: SMTP выключен — только печатаем в лог
    if not EMAIL_ENABLED:
        _print_code(to_email, subject, body)
        return True

    # SMTP включён, но креды не заданы — тоже печатаем, чтобы не падать
    if not SMTP_USER or not SMTP_PASSWORD:
        print("[EMAIL WARN] EMAIL_ENABLED=true, но SMTP_USER/SMTP_PASSWORD не заданы")
        _print_code(to_email, subject, body)
        return True

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = SMTP_FROM
    msg["To"] = to_email

    try:
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.starttls()
                s.login(SMTP_USER, SMTP_PASSWORD)
                s.send_message(msg)
        print(f"[EMAIL OK] Письмо отправлено на {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        _print_code(to_email, subject, body)
        return False