FROM python:3.11-slim

# Install system dependencies (libmagic untuk validasi PDF)
RUN apt-get update && apt-get install -y \
    libmagic1 \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install psycopg2 untuk PostgreSQL
RUN pip install --no-cache-dir psycopg2-binary gunicorn

# Copy source code
COPY backend/ .

# Buat folder storage untuk file upload
RUN mkdir -p /app/storage

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
