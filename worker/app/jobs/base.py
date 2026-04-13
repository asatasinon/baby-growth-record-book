from dataclasses import dataclass
from typing import Any


@dataclass
class TaskJob:
    id: int
    job_type: str
    payload: dict[str, Any]
    retry_count: int = 0
    max_retries: int = 3
