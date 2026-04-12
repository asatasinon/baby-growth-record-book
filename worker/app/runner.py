import logging
import time

from app.core.config import get_settings
from app.jobs import aggregate_daily, ai_summary, export_report, scan_alerts
from app.jobs.base import TaskJob

logger = logging.getLogger(__name__)

HANDLERS = {
    "aggregate_daily": aggregate_daily.handle,
    "export_report": export_report.handle,
    "scan_alerts": scan_alerts.handle,
    "generate_ai_summary": ai_summary.handle,
}


def mock_fetch_jobs() -> list[TaskJob]:
    """Mock queue to keep the worker skeleton runnable before DB polling is wired."""
    return [
        TaskJob(id="1", job_type="aggregate_daily", payload={"family_id": "20001", "baby_id": "30001"}),
        TaskJob(id="2", job_type="scan_alerts", payload={"family_id": "20001"}),
    ]


def run_forever() -> None:
    settings = get_settings()
    logger.info("worker.started", extra={"app_env": settings.app_env})

    while True:
        jobs = mock_fetch_jobs()
        for job in jobs:
            handler = HANDLERS.get(job.job_type)
            if not handler:
                logger.warning("worker.job.unknown", extra={"job_type": job.job_type, "job_id": job.id})
                continue

            logger.info("worker.job.start", extra={"job_id": job.id, "job_type": job.job_type})
            handler(job)
            logger.info("worker.job.done", extra={"job_id": job.id, "job_type": job.job_type})

        time.sleep(settings.poll_interval_seconds)
