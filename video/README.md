# That DAM Toolbox – *Pythonista-friendly*, pure-stdlib façade

```
Updated directory layout (depth ≤ 1)
────────────────────────────────────
video/
├── __init__.py          # this file – high-level API
├── __main__.py          # universal entry-point (CLI ⇄ API)
├── api.py               # FastAPI app object (lazy import)
├── bootstrap.py         # first-run helpers & env checks
├── cli.py               # argparse + sub-commands
├── commands.py          # dataclass DTOs for CLI & TUI
├── config.py            # global settings, paths, env-vars
├── db.py                # SQLite interface + migrations
├── hwaccel.py           # optional FFmpeg HW acceleration helpers
├── paths.py             # canonical path helpers (XDG, iOS, etc.)
├── preview.py           # preview / proxy generation
├── probe.py             # tech-metadata extraction (codec, resolution…)
├── scanner.py           # multithreaded file walker + SHA-1 pipeline
├── server.py            # tiny stdlib HTTP fallback
├── sync.py              # Photos / iCloud / remote importers
├── tui.py               # rich-based TUI frontend
├── schema.sql           # DB schema & migrations
├── video.cfg            # sample INI config
├── video.1              # man-page (generated)
├── test_script.py       # quick self-test / smoke-run
# sub-packages (expand separately)
├── core/                # domain logic split into bounded contexts
├── dam/                 # digital-asset-management utilities
├── helpers/             # misc pure-stdlib helpers
├── models/              # pydantic / dataclass models
├── modules/             # plugin auto-discovery root
├── storage/             # storage back-ends (S3, MinIO, local…)
└── web/                 # static files & SPA frontend bundle
```

