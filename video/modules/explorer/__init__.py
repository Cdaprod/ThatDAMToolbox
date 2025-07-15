"""
Explorer plug-in  – primary discovery front-end

Adds:
• REST  GET /explorer               – recent artifacts (grid view)
• REST  GET /explorer/batch/{id}    – batch drill-down
• CLI   video explore [...]         – optional (see commands.py)
"""
from . import routes        # auto-mount via video.api plug-in loader
from . import commands      # optional: registers CLI verb

# Re-export router so other code can import easily
router = routes.router