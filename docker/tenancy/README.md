# Tenancy Container

Packages the FastAPI tenancy daemon for plan reconciliation. Service code lives in the repository root under `tenancy/`.

## Usage
```bash
# build the image
docker build -f docker/tenancy/Dockerfile -t cdaprod/tenancy .
# run the service
docker run -p 8082:8082 cdaprod/tenancy
```

## Environment
The daemon reads profile and cluster inputs from API requests; no required environment variables.

## Testing
```bash
pytest tests/test_tenancy.py -q
```
