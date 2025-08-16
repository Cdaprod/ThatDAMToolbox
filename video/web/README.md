# Web Package

Jinja2 templates and static assets served by the FastAPI application.  The API mounts `static` at `/static` and renders templates from `templates`.

```python
from fastapi import FastAPI
from fastapi.templating import Jinja2Templates

app = FastAPI()
templates = Jinja2Templates(directory="video/web/templates")
```

