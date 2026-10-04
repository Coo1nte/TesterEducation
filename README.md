# Конструктор тестов

Веб-приложение для создания тестов, опросов и анкет с онлайн-прохождением по ссылке или QR-коду.

**Стек:** FastAPI + SQLAlchemy + PostgreSQL · React + Vite + Tailwind · Nginx · Docker Compose

---

## Возможности

### Конструктор
- 5 типов вопросов: один ответ, несколько ответов, текстовый ответ, сопоставление, расстановка по порядку
- Картинки к вопросам и вариантам (ссылка или загрузка с устройства)
- Обязательные вопросы
- Импорт вопросов из CSV-файла
- Папки для группировки тестов
- Дублирование тестов

### Настройки теста
- Тип: тест с баллами / опрос / аналитика
- Таймер (в минутах, 0 = без ограничения)
- Перемешивание вопросов
- Случайная выборка: N вопросов из банка (например, 20 из 100)

### Прохождение
- По share-коду (`/?code=XXXXXX`) или QR-коду
- Без регистрации — гость вводит только имя
- Автоотправка при истечении таймера
- Проверка обязательных вопросов

### Результаты
- Список всех прохождений
- Разбор ответов по каждому ученику (для тестов с баллами)
- Сводная статистика по вопросам (для опросов и аналитики)
- Экспорт в CSV (открывается в Excel)
- Удаление отдельного прохождения

### Авторизация
- Регистрация с подтверждением почты (6-значный код)
- Вход по логину **или** email
- Восстановление пароля по коду из письма
- Напоминание логина на почту
- JWT-токены (72 часа)

---

## Быстрый старт (Docker)

### 1. Клонировать и подготовить окружение

```bash
git clone https://github.com/Coo1nte/TesterEducation.git
cd TesterEducation
cp .env.example .env
```

Отредактируй `.env`:

```env
# ==================== POSTGRES ====================
POSTGRES_USER=tests
POSTGRES_PASSWORD=strong_password_here
POSTGRES_DB=tests

# ==================== BACKEND ====================
JWT_SECRET=<сгенерируй: python -c "import secrets; print(secrets.token_urlsafe(48))">
CODE_TTL_MINUTES=10

# ==================== EMAIL ====================
# false = код печатается в лог контейнера (удобно для локальной разработки)
# true  = реальная отправка через SMTP (нужны SMTP_* ниже)
EMAIL_ENABLED=false

SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=your_email@yandex.ru
SMTP_PASSWORD=your_app_password
SMTP_FROM=your_email@yandex.ru

# ==================== CORS ====================
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# ==================== FRONTEND ====================
APP_PORT=80
```

### 2. Запустить

```bash
docker compose up -d --build
```

Открой `http://localhost` — готово.

### 3. Как получить код регистрации

По умолчанию `EMAIL_ENABLED=false`, поэтому письма **не отправляются**. Код печатается в лог бэкенда:

```bash
docker compose logs -f backend | grep "EMAIL ->"
```

Или последний код из уже накопленного лога:

```bash
docker compose logs backend | grep "Ваш код подтверждения" | tail -1
```

Если хочешь **реальную отправку** — установи `EMAIL_ENABLED=true` и настрой SMTP (см. раздел «Настройка SMTP»).

### 4. Полезные команды

```bash
docker compose logs -f backend      # логи бэкенда
docker compose logs -f frontend     # логи Nginx
docker compose logs -f db           # логи Postgres
docker compose ps                   # статус контейнеров
docker compose down                 # остановить
docker compose down -v              # остановить и снести БД
curl http://localhost/api/db-check  # проверка подключения к БД
```

---

## Настройка SMTP

Для реальной отправки писем установи `EMAIL_ENABLED=true` и заполни `SMTP_*`.

### Вариант A: Resend (рекомендуется)

Простой сервис, бесплатно 100 писем/день.

1. Зарегистрируйся на [resend.com](https://resend.com).
2. Создай API-ключ.
3. В `.env`:

```env
EMAIL_ENABLED=true
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=onboarding@resend.dev
```

⚠️ `onboarding@resend.dev` работает **только для отправки на email, привязанный к аккаунту Resend**. Для остальных адресов — верифицируй свой домен.

### Вариант B: Яндекс SMTP

1. Зайди в **веб-интерфейс Яндекс Почты** (это обязательно — без визита SMTP не заработает).
2. Настройки → **Почтовые программы** → включи:
   - ✅ «С сервера imap.yandex.ru по протоколу IMAP»
   - ✅ «Пароли приложений и OAuth-токены»
3. Создай **пароль приложения** (тип «Почта») — это не пароль от почты, а отдельный код, показывается один раз.
4. В `.env`:

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=your_email@yandex.ru
SMTP_PASSWORD=пароль_приложения
SMTP_FROM=your_email@yandex.ru
```

⚠️ `SMTP_FROM` **должен совпадать** с `SMTP_USER`, иначе Яндекс отклонит письмо с ошибкой `553 Sender address rejected`.

⚠️ Ошибка `535 5.7.8 This user does not have access rights to this service` означает, что SMTP-доступ не включён. Проверь пункты 1–3 выше или используй Resend.

---

## Локальная разработка (без Docker)

### Бэкенд

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Создай `backend/.env`:

```env
JWT_SECRET=dev-secret-change-me
DATABASE_URL=sqlite:///./tests.db
CODE_TTL_MINUTES=10
EMAIL_ENABLED=false
```

Бэкенд поднимется на `http://127.0.0.1:8000`. Документация — `http://127.0.0.1:8000/docs`.

### Фронтенд

```bash
npm install
npm run dev
```

Vite откроет `http://localhost:5173`, запросы уйдут на `http://127.0.0.1:8000` (см. `src/api.js`).

---

## Формат CSV для импорта вопросов

Колонки: `question, type, option1..N, correct, image, left, right, item1..N`

### Примеры

```csv
question,type,option1,option2,option3,option4,correct,image
Столица Франции?,single,Париж,Лондон,Берлин,Мадрид,1,
Выберите чётные числа,multiple,1,2,3,4,"2;4",
Что такое H2O?,text,,,,,вода,
Расположите по возрастанию,order,1,2,3,4,,,
Столицы,match,Франция,Париж,,,,
Столицы,match,Германия,Берлин,,,,
```

### Правила

- `correct` для `single` — номер варианта (с 1)
- `correct` для `multiple` — номера через `;` в кавычках (`"2;4"`)
- `correct` для `text` — сам правильный ответ
- `match` — по одной паре на строку, одинаковый `question` склеивает пары в один вопрос
- `order` — правильный порядок = порядок колонок `item1, item2, ...`
- Разделитель определяется автоматически: `,` или `;` (для русского Excel)

Шаблон можно скачать прямо в конструкторе — кнопка «Формат CSV — подсказка».

---

## Переменные окружения

| Переменная | Обязательна | Описание |
|---|---|---|
| `JWT_SECRET` | да | Ключ для подписи JWT. Без него бэкенд не запустится |
| `DATABASE_URL` | да* | Строка подключения SQLAlchemy |
| `CODE_TTL_MINUTES` | нет | Время жизни кода из письма (по умолчанию 10) |
| `EMAIL_ENABLED` | нет | `true` = реальная отправка, `false` = печать в лог |
| `SMTP_HOST` | да** | SMTP-сервер |
| `SMTP_PORT` | да** | 465 (SSL) или 587 (STARTTLS) |
| `SMTP_USER` | да** | Логин на SMTP |
| `SMTP_PASSWORD` | да** | Пароль или app password |
| `SMTP_FROM` | нет | Адрес отправителя (по умолчанию = `SMTP_USER`) |
| `RESEND_API_KEY` | нет | Ключ Resend, если используешь Resend |
| `FROM_EMAIL` | нет | Адрес отправителя для Resend |
| `POSTGRES_*` | да*** | Креды для Postgres в compose |
| `CORS_ORIGINS` | нет | Домены фронта через запятую. Пусто = `*` |
| `APP_PORT` | нет | Внешний порт Nginx (по умолчанию 80) |

\* В Docker compose задаётся автоматически. Для локальной разработки — задай в `backend/.env`.  
\** Нужны, если `EMAIL_ENABLED=true`.  
\*** Только для Postgres в compose. Для Neon — задай `DATABASE_URL` напрямую.

---

## API (кратко)

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/` | Healthcheck |
| GET | `/db-check` | Диагностика БД |
| GET | `/tests` | Список тестов текущего пользователя |
| GET | `/tests/by-code/{code}` | Тест по share-коду (для гостя) |
| POST | `/tests` | Создать тест |
| PUT | `/tests/{id}` | Обновить тест |
| DELETE | `/tests/{id}` | Удалить тест |
| POST | `/tests/{id}/submissions` | Добавить прохождение |
| DELETE | `/tests/{id}/submissions/{subId}` | Удалить прохождение |
| POST | `/auth/register/start` | Отправить код на почту |
| POST | `/auth/register/confirm` | Подтвердить код |
| POST | `/auth/login` | Вход по логину/email |
| POST | `/auth/reset/start` | Отправить код для сброса |
| POST | `/auth/reset/confirm` | Новый пароль |
| POST | `/auth/forgot-login` | Напомнить логин |

Полная документация — `/docs` (Swagger UI). На проде через Nginx — `http://<домен>/api/docs`.

---

## Структура проекта

```
.
├── backend/
│   ├── main.py              # FastAPI: роуты
│   ├── models.py            # SQLAlchemy-модели
│   ├── schemas.py           # Pydantic-схемы
│   ├── database.py          # Движок и сессии
│   ├── auth.py              # Хэши, JWT, коды
│   ├── mailer.py            # Отправка email (SMTP/Resend)
│   ├── requirements.txt
│   └── Dockerfile
├── src/
│   ├── App.jsx              # Корневой компонент + все экраны
│   ├── api.js               # Клиент API
│   └── csvImport.js         # Парсер CSV
├── public/
├── nginx.conf               # Раздача статики + прокси /api/
├── Dockerfile.frontend      # Многоступенчатая сборка фронта
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Деплой на сервер

1. Арендуй VPS (Selectel, Timeweb, Hetzner — от ~200 ₽/мес).
2. Установи Docker и Docker Compose.
3. Скопируй проект, заполни `.env` (обязательно `JWT_SECRET`, `POSTGRES_PASSWORD`).
4. Для HTTPS поставь **Caddy** перед `frontend`:

   `Caddyfile`:
   ```
   your-domain.com {
       reverse_proxy frontend:80
   }
   ```

   В `docker-compose.yml` добавь сервис `caddy` и убери `ports` у `frontend` (наружу торчит только Caddy).

5. В `backend/main.py` замени CORS:
   ```python
   allow_origins=["https://your-domain.com"],
   ```

6. Запусти:
   ```bash
   docker compose up -d --build
   ```

Caddy автоматически получит SSL-сертификат Let's Encrypt.

### Бэкапы

```bash
# Дамп базы
docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup-$(date +%F).sql

# Восстановление
cat backup-2024-01-01.sql | docker compose exec -T db psql -U $POSTGRES_USER $POSTGRES_DB
```

---

## Известные ограничения

- **Пароли и секреты в `.env`** — держи файл в `.gitignore`
- **Нет rate-limit на ввод кода** — легко перебрать 6-значный код. Для прода добавь ограничение попыток
- **`share_code` теста — 6 hex-символов** (16^6 ≈ 16 млн комбинаций) — угадываемо без rate-limit
- **Нет миграций БД** — используется `create_all`. При изменении схемы старые таблицы не обновляются. Для прода — Alembic
- **Письма в dev-режиме** печатаются в лог контейнера — если разворачиваешь публично, настрой SMTP

---

## Лицензия

MIT