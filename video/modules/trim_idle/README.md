# Trim Idle Module

Removes frozen or idle segments from a video using either FFmpeg's `freezedetect` filter or an OpenCV MSE comparison.

## CLI

```bash
python -m video trim_idle --video in.mp4 --out trimmed.mp4 --method ffmpeg
```

## REST

```bash
curl -F file=@in.mp4 http://localhost:8080/trim_idle/ -o trimmed.mp4
```

Requires `ffmpeg` and optionally `opencv-python-headless` for the OpenCV backend.

