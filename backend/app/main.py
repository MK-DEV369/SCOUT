from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.ml_routes import router as ml_router
from app.api.phase_routes import router as phase_router
from app.api.routes import router as api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.ingestion.scheduler import start_scheduler

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)
app.include_router(ml_router, prefix=settings.api_v1_prefix)
app.include_router(phase_router, prefix=settings.api_v1_prefix)

frontend_dir = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")


@app.on_event("startup")
async def startup_event() -> None:
    start_scheduler()
