"""FastAPI application factory for the video service."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging

from video.bootstrap import bootstrap
from video.web import static
from video.ws import router as ws_router
from video.api import modules                 # ← keep this
from video.api.routes import routers          # first-party routers you already have
from video.core.event import get_bus
from video.core.event.types import Event, Topic
from video.logging import tenant_id_var, principal_id_var

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

    # first-party routes (explicit list in video.api.routes)
    for r in routers:
        app.include_router(r)

    # toggle-aware modules wiring:
    # VERSION=1 → only static mounts
    # VERSION=2 → routers + static mounts
    modules.init_modules(app)

    log = logging.getLogger("request")

    @app.middleware("http")
    async def _bind_log_context(request: Request, call_next):
        tenant = request.headers.get("X-Tenant-ID", "-")
        principal = request.headers.get("X-Principal-ID", "-")
        t_token = tenant_id_var.set(tenant)
        p_token = principal_id_var.set(principal)
        bus = get_bus()
        if bus:
            try:
                await bus.publish(Event(topic="tenant.access", payload={"tenant_id": tenant, "principal_id": principal, "path": request.url.path}))
            except Exception as exc:  # noqa: BLE001
                log.warning("tenant event publish failed: %s", exc)
        response = await call_next(request)
        log.info("%s", request.url.path)
        tenant_id_var.reset(t_token)
        principal_id_var.reset(p_token)
        return response

    @app.on_event("startup")
    async def _emit_service_up() -> None:
        bus = get_bus()
        if not bus:
            return
        try:
            # ensure the bus is actually connected before publishing
            await bus.start()
            await bus.wait_ready(timeout=5)
            await bus.publish(Event(topic=Topic.VIDEO_API_SERVICE_UP))
        except Exception as e:
            # log, but do NOT fail the app
            log.warning("Startup event skipped (bus not ready): %s", e)

    return app
