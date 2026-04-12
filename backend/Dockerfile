FROM python:3.13-slim

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml README.md ./
RUN uv sync

COPY app ./app
COPY main.py ./main.py

CMD ["uv", "run", "python", "main.py"]
