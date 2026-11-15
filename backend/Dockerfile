FROM python:3.11-slim

WORKDIR /workspace/backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=wsgi.py \
    FLASK_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgeos-dev \
    proj-bin \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /workspace/backend/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt gunicorn

COPY data /workspace/data
COPY docs /workspace/docs
COPY backend /workspace/backend

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--timeout", "60", "wsgi:app"]
