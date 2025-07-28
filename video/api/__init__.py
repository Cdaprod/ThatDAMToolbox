# video/api/__init__.py
from .api      import app                    # your FastAPI() from api.py
from .modules  import setup_module_static_mounts
import video.modules                         # populated by bootstrap

# 1) wire in every plug-in router
for r in video.modules.routers:
    app.include_router(r)

# 2) mount every plug-in’s static dirs
setup_module_static_mounts(app)

__all__ = ("app",)