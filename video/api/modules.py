# /video/api/modules.py
from fastapi.staticfiles import StaticFiles
from fastapi import HTTPException
from video.config import _MODULE_PATH_REGISTRY

def setup_module_static_mounts(app):
    """Auto-mount each module's configured static directories"""
    for module_name, paths in _MODULE_PATH_REGISTRY.items():
        for key, filesystem_path in paths.items():
            mount_path = f"/modules/{module_name}/{key}"
            
            # serve raw files
            app.mount(
                mount_path,
                StaticFiles(directory=str(filesystem_path), html=False),
                name=f"modules-{module_name}-{key}"
            )

            # list endpoint → GET /modules/{module_name}/{key}/list
            @app.get(f"{mount_path}/list", name=f"list-{module_name}-{key}")
            async def _list_module_assets(module=module_name, key=key):
                """Dynamically generated: list files in this module/key"""
                import os
                base = _MODULE_PATH_REGISTRY[module][key]
                try:
                    files = sorted(os.listdir(base))
                except FileNotFoundError:
                    raise HTTPException(404, "Not found")
                return [
                    {"filename": fn, "url": f"/modules/{module}/{key}/{fn}"}
                    for fn in files
                ]