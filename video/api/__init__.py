# video/api/__init__.py
from .api import app
from .modules import setup_module_static_mounts

# Auto-mount each module’s static dirs under /modules/{module}/{key}…
setup_module_static_mounts(app)

__all__ = ("app",)