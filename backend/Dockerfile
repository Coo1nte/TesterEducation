FROM python:3.12-slim

# Системные зависимости для psycopg2 и bcrypt
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Сначала только requirements — чтобы кэш слоёв работал
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Потом код
COPY . .

EXPOSE 8000

# healthcheck — чтобы docker-compose знал, когда сервис готов
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fs http://localhost:8000/ || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]