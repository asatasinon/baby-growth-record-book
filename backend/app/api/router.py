from fastapi import APIRouter

from app.api.health import router as health_router
from app.modules.admin.router import router as admin_router
from app.modules.ai.router import router as ai_router
from app.modules.analytics.router import router as analytics_router
from app.modules.auth.router import router as auth_router
from app.modules.baby.router import router as baby_router
from app.modules.event.router import router as event_router
from app.modules.family.router import router as family_router
from app.modules.notify.router import router as notify_router
from app.modules.report.router import router as report_router
from app.modules.summary.router import router as summary_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(family_router)
api_router.include_router(baby_router)
api_router.include_router(event_router)
api_router.include_router(summary_router)
api_router.include_router(analytics_router)
api_router.include_router(notify_router)
api_router.include_router(report_router)
api_router.include_router(ai_router)
api_router.include_router(admin_router)
api_router.include_router(health_router)
