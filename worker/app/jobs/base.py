from dataclasses import dataclass
from typing import Any


@dataclass
class TaskJob:
    id: str
    job_type: str
    payload: dict[str, Any]
