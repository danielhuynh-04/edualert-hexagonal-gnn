FROM python:3.10-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY src ./src
COPY frontend ./frontend
COPY db ./db

# Pre-initialize SQLite 3NF database & Sheaf-GNN assessment cache at build time
RUN python -c "from backend.app import ensure_initialized; ensure_initialized()"

EXPOSE 8000

CMD ["gunicorn", "--bind=0.0.0.0:8000", "--timeout", "600", "--workers", "2", "backend.wsgi:app"]
