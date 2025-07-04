from pathlib import Path
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

_pkg = Path(__file__).parent
templates = Jinja2Templates(directory=_pkg / "templates")
static     = StaticFiles(directory=_pkg / "static")