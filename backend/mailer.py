import os
import requests as http

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@take-test.ru")


def send_code_email(to_email: str, code_or_text: str, purpose: str):
    """
    purpose:
      'register' — код подтверждения регистрации
      'reset'    — код для смены пароля
    """

    if code_or_text.lower().startswith("ваш логин"):
        subject = "Ваш логин"
        body = code_or_text
    elif purpose == "reset":
        subject = "Код для смены пароля"
        body = (
            f"Ваш код для смены пароля: {code_or_text}\n\n"
            f"Код действует 10 минут.\n"
            f"Если вы не запрашивали смену пароля — просто проигнорируйте письмо."
        )
    else:
        subject = "Код подтверждения регистрации"
        body = (
            f"Ваш код подтверждения: {code_or_text}\n\n"
            f"Введите его в приложении, чтобы завершить регистрацию.\n"
            f"Код действует 10 минут."
        )

    # Если API-ключ не задан — печатаем код в лог (для локальной разработки)
    if not RESEND_API_KEY:
        print("=" * 50)
        print(f"[EMAIL -> {to_email}] {subject}")
        print(body)
        print("=" * 50)
        return

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
            timeout=10,
        )
        if resp.status_code in (200, 201):
            print(f"[EMAIL OK] Письмо отправлено на {to_email}")
        else:
            print(f"[EMAIL ERROR] {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")
        print(f"[EMAIL -> {to_email}] {subject}\n{body}")
