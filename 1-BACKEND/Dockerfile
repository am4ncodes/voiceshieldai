FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Make everything writable for non-root runtimes (Render/HF/etc.)
RUN chmod -R 777 /app

ENV PORT=5000
EXPOSE 5000

CMD ["sh", "-c", "gunicorn app:app --workers 1 --timeout 180 --bind 0.0.0.0:${PORT}"]
