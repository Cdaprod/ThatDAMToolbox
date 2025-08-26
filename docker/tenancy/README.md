# Tenancy Container

Packages the Go-based tenancy service.

## Usage
```bash
# build the image
docker build -f docker/tenancy/Dockerfile -t cdaprod/tenancy .
# run the service
docker run -p 8082:8082 cdaprod/tenancy
```

## Testing
```bash
go test ./host/services/tenancy
```
