"""Collection of API subrouters."""
from . import batches, cli, media, paths, root, health

routers = [
    media.router,
    batches.router,
    paths.router,
    cli.router,
    root.router,
    health.router,
]

__all__ = ["routers"]
