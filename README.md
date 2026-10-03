# Конструктор тестов
**Мод на https://github.com/Horkeez/my-tests-app/tree/main**

Веб-приложение для создания тестов, опросов и анкет с онлайн-прохождением по ссылке или QR-коду.

**Стек:** FastAPI + SQLAlchemy + PostgreSQL · React + Vite + Tailwind · Nginx · Docker Compose

### Конструктор
- 5 типов вопросов: один ответ, несколько ответов, текстовый ответ, сопоставление, расстановка по порядку
- Картинки к вопросам и вариантам (ссылка или загрузка с устройства)
- Обязательные вопросы
- Импорт вопросов из CSV-файла (mod)
- Папки для группировки тестов
- Дублирование тестов

### Настройки теста
- Тип: тест с баллами / опрос / аналитика
- Таймер (в минутах, 0 = без ограничения)
- Перемешивание вопросов
- Случайная выборка: N вопросов из банка (например, 20 из 100) (mod)

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
- JWT-токены

## Быстрый старт (Docker)

### 1. Клонировать и подготовить окружение

```bash
git clone https://github.com/Coo1nte/TesterEducation.git
cd TesterEducation
cp .env.example .env
```
Отредактируй `.env`:

```env
POSTGRES_USER=tests
POSTGRES_PASSWORD=strong_password_here
POSTGRES_DB=tests

SECRET_KEY=<сгенерируй: python -c "import secrets; print(secrets.token_urlsafe(48))">

SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=your_email@yandex.ru
SMTP_PASSWORD=your_app_password
SMTP_FROM=your_email@yandex.ru

APP_PORT=80
```

### 2. Запустить

```bash
docker compose up -d --build
```

Открой `http://localhost` — готово.

### 3. Полезные команды

```bash
docker compose logs -f backend      # логи бэкенда
docker compose logs -f frontend     # логи nginx
docker compose down                 # остановить
docker compose down -v              # остановить и снести БД
curl http://localhost/api/db-check  # проверка подключения к БД
```

## Локальная разработка (без Docker)

### Бэкенд

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Создай `.env` в корне `backend/` с `DATABASE_URL`, `SECRET_KEY`, SMTP-настройками.

### Фронтенд

```bash
npm install
npm run dev
```

Vite откроет `http://localhost:5173`, запросы уйдут на `http://127.0.0.1:8000` (см. `api.js`).

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

Правила:
- `correct` для `single` — номер варианта (с 1)
- `correct` для `multiple` — номера через `;` в кавычках
- `correct` для `text` — сам правильный ответ
- `match` — по одной паре на строку, одинаковый `question` склеивает пары
- `order` — правильный порядок = порядок колонок `item1, item2, ...`
- Разделитель определяется автоматически: `,` или `;` (для русского Excel)

Шаблон можно скачать прямо в конструкторе — кнопка «Формат CSV — подсказка».

## Переменные окружения

| Переменная | Обязательна | Описание |
|---|---|---|
| `DATABASE_URL` | да | Строка подключения SQLAlchemy |
| `SECRET_KEY` | да | Ключ для подписи JWT |
| `SMTP_HOST` | да* | SMTP-сервер |
| `SMTP_PORT` | да* | 465 (SSL) или 1025 (MailHog) |
| `SMTP_USER` | да* | Логин на SMTP |
| `SMTP_PASSWORD` | да* | Пароль или app password |
| `SMTP_FROM` | нет | Адрес отправителя (по умолчанию = `SMTP_USER`) |
| `POSTGRES_*` | да** | Креды для локального Postgres в compose |
| `APP_PORT` | нет | Внешний порт Nginx (по умолчанию 80) |

\* Для работы писем. Без SMTP остальное приложение работает, но регистрация и сброс пароля недоступны.  
\** Только если используешь Postgres из compose. Для Neon — задай `DATABASE_URL` напрямую.

## API (кратко)

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/` | Healthcheck |
| GET | `/db-check` | Диагностика БД |
| GET | `/tests?owner=...` | Список тестов пользователя |
| GET | `/tests/by-code/{code}` | Тест по share-коду |
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

## Деплой на сервер

1. Установи Docker и Docker Compose на VPS.
2. Скопируй проект, заполни `.env`.
3. Для HTTPS поставь **Caddy** или **certbot** перед `frontend`:

   ```
   your-domain.com {
       reverse_proxy frontend:80
   }
   ```

4. В `main.py` замени CORS:
   ```python
   allow_origins=["https://your-domain.com"],
   ```
5. `docker compose up -d --build`

### Бэкапы

```bash
# Дамп базы
docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup-$(date +%F).sql

# Восстановление
cat backup-2024-01-01.sql | docker compose exec -T db psql -U $POSTGRES_USER $POSTGRES_DB
```

## Известные ограничения

- Пароль от почты хранится в `.env` — держи файл в `.gitignore`
- Нет ограничения попыток ввода кода (rate-limit) — добавь в прод
- `share_code` теста — 6 hex-символов (угадываемо), увеличь при необходимости
- Авторизация на эндпоинтах `/tests/*` пока не enforced — функция `get_current_user` готова к использованию

## Лицензия

MIT
