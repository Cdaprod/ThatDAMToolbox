# MinIO Container

This image wraps [MinIO](https://min.io/) and uses `entrypoint.sh` to ensure required buckets exist on startup.

## Environment Variables

- `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` – credentials for the root user (required).
- `MINIO_BUCKET_MEDIA` – name of the media bucket created at startup.
- `MINIO_BUCKET_WEAVIATE_BACKUPS` – optional bucket used for Weaviate backups.
- `MINIO_MEDIA_PUBLIC` – when set, the media bucket is made publicly readable.
- `MINIO_SVC_ACCESS_KEY` / `MINIO_SVC_SECRET_KEY` – when both are provided, a service account is created for the root user.

## Example

```bash
MINIO_ROOT_USER=minio \
MINIO_ROOT_PASSWORD=minio123 \
MINIO_BUCKET_MEDIA=media \
MINIO_MEDIA_PUBLIC=1 \
MINIO_SVC_ACCESS_KEY=svcuser \
MINIO_SVC_SECRET_KEY=svcpw \
./entrypoint.sh
```
