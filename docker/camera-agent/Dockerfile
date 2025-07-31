# /docker/camera-agent/Dockerfile
FROM python:3.10-slim

# Avoid Python buffering so logs appear in real‐time
ENV PYTHONUNBUFFERED=1

# Install OS packages required by OpenCV
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libglib2.0-0 \
      libsm6 \
      libxext6 \
      libxrender1 \
      avahi-utils \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python deps
COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# Copy your agent script
COPY camera_agent.py .

# Run the agent; it reads DEVICE_ID & SERVER_WS from env
CMD ["python", "camera_agent.py"]