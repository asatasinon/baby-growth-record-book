FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml README.md ./
RUN uv sync

COPY app ./app

CMD ["uv", "run", "python", "-m", "app.main"]
