from app.jobs.base import TaskJob


def handle(job: TaskJob) -> None:
    print(f"[export_report] render report for payload={job.payload}")
