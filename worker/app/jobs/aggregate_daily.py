from app.jobs.base import TaskJob


def handle(job: TaskJob) -> None:
    print(f"[aggregate_daily] recalculate summaries for payload={job.payload}")
