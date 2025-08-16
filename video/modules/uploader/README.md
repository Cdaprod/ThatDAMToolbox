# Uploader Module

Asynchronous multipart uploader.  Files are staged to a directory and ingested in the background.

## Workflow

1. Upload files via REST endpoint
2. Files written to staging directory (`uploader/staging` by default)
3. Background task moves files into storage and registers artifacts

### REST example

```bash
curl -F files=@clip.mp4 http://localhost:8080/api/v1/upload
```

CLI helper:

```bash
python -m video upload clip.mp4 --batch Demo
```

