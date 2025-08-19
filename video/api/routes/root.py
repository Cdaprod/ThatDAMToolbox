"""Root HTML endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse

from video.web import templates

router = APIRouter()


@router.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse("video/web/static/favicon/favicon.ico")


@router.get("/", include_in_schema=False)
async def home(request: Request):
    return templates.TemplateResponse("dashboard.html", {"request": request})
