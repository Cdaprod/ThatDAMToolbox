# Dockerfile for Tenancy service
# Example:
#   docker build -t thatdamtoolbox/tenancy -f docker/tenancy/Dockerfile .
FROM python:3.11-slim
WORKDIR /app
COPY docker/tenancy/requirements.txt /tmp/requirements.txt
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && pip install --no-cache-dir -r /tmp/requirements.txt \
    && rm -rf /var/lib/apt/lists/*
COPY tenancy/ /app/tenancy/
EXPOSE 8082
CMD ["uvicorn", "tenancy.app:app", "--host", "0.0.0.0", "--port", "8082"]
