from app.jobs.base import TaskJob


def handle(job: TaskJob) -> None:
    print(f"[generate_ai_summary] create summary for payload={job.payload}")
