from app.jobs.base import TaskJob


def handle(job: TaskJob) -> None:
    print(f"[scan_alerts] evaluate rules for payload={job.payload}")
