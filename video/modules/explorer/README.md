# Explorer Module

Provides simple file‑system browsing APIs used by the web dashboard.

Endpoints:

- `GET /explorer` – list registered roots
- `GET /explorer/folder/{path}` – list files in a folder
- `GET /explorer/batch/{id}` – inspect an ingest batch

```bash
curl http://localhost:8080/explorer
curl http://localhost:8080/explorer/folder/~/Videos
```

