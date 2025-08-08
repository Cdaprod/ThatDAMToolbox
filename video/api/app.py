"""FastAPI application factory for the video service."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from video.bootstrap import bootstrap
from video.web import static
from video.ws import router as ws_router
from video.api import modules
from video.api.modules import setup_module_static_mounts
from video.api.routes import routers
from video.core.event import get_bus
from video.core.event.types import Event, Topic

origins = ["http://localhost:3000"]


def create_app() -> FastAPI:
    """Create and configure a FastAPI application."""
    bootstrap()

    app = FastAPI(title="Video DAM API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount("/static", static, name="static")
    app.include_router(ws_router)

    # first-party routes
    for r in routers:
        app.include_router(r)

    # plug-in routers + static mounts
    for r in modules.routers:
        app.include_router(r)
    setup_module_static_mounts(app)

    @app.on_event("startup")
    async def _emit_service_up() -> None:  # pragma: no cover - network I/O
        bus = get_bus()
        if bus:
            await bus.publish(Event(topic=Topic.VIDEO_API_SERVICE_UP))

    return app
