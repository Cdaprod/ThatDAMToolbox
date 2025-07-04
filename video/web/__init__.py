# video/web/__init__.py  (tiny helper so it's importable)
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

ROOT = Path(__file__).resolve().parent
static     = StaticFiles(directory=ROOT / "static")
templates  = Jinja2Templates(directory=ROOT / "templates")