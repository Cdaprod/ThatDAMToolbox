# video-api Docker Image

Build and run the video API service.

## Usage

```bash
docker build -f docker/video-api/Dockerfile -t video-api .
docker run -p 8080:8080 video-api
```

## Tests

This service relies on repository-wide tests:

```bash
pytest deploy_tests/test_compose_files.py::test_compose_files_exist
```
