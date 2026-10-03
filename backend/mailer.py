import os
import requests as http

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL")
if RESEND_API_KEY and not FROM_EMAIL:
    raise RuntimeError("FROM_EMAIL обязателен при использовании Resend")
CODE_TTL_MINUTES = int(os.environ.get("CODE_TTL_MINUTES", "10"))
HTTP_TIMEOUT = 15


def send_code_email(to_email: str, code_or_text: str, purpose: str) -> bool:
    """
    purpose:
      'register'        — код подтверждения регистрации
      'reset'           — код для смены пароля
      'login_reminder'  — напоминание логина
    """
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
    else:  # register
        subject = "Код подтверждения регистрации"
        body = (
            f"Ваш код подтверждения: {code_or_text}\n\n"
            f"Введите его в приложении, чтобы завершить регистрацию.\n"
            f"Код действует {CODE_TTL_MINUTES} минут.\n"
        )

    # Если API-ключ не задан — печатаем код в лог (для локальной разработки)
    if not RESEND_API_KEY:
        print("=" * 50)
        print(f"[EMAIL -> {to_email}] {subject}")
        print(body)
        print("=" * 50)
        return True

    try:
        resp = http.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": f"Конструктор тестов <{FROM_EMAIL}>",
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code in (200, 201):
            print(f"[EMAIL OK] Письмо отправлено на {to_email}")
            return True
        else:
            print(f"[EMAIL ERROR] {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        print(f"[EMAIL -> {to_email}] {subject}\n{body}")
        return False
