#!/bin/bash

# src/sh/src.sh - Camera Producer Bootstrapper (Host-level)

# Configurable defaults
PRODUCER_BACKEND="${PRODUCER_BACKEND:-auto}"   # auto, ffmpeg, gstreamer, v4l2
PRODUCER_ROOT="/tmp/camera-producers"
DEVICE_PREFIX="/dev/video"
LOG_DIR="/var/log/camera-producer"
mkdir -p "$LOG_DIR" "$PRODUCER_ROOT"

# Optional: Minimum video index (skip video0 if using for system desktop)
START_IDX="${START_IDX:-0}"

# Auto-detect the best producer backend
detect_backend() {
  if command -v ffmpeg >/dev/null 2>&1; then
    echo "ffmpeg"
  elif command -v gst-launch-1.0 >/dev/null 2>&1; then
    echo "gstreamer"
  elif command -v v4l2-ctl >/dev/null 2>&1; then
    echo "v4l2"
  else
    echo "none"
  fi
}

BACKEND="$PRODUCER_BACKEND"
if [[ "$PRODUCER_BACKEND" == "auto" ]]; then
  BACKEND=$(detect_backend)
  if [[ "$BACKEND" == "none" ]]; then
    echo "No video producer backend found. Exiting."
    exit 1
  fi
fi

echo "[src.sh] Using backend: $BACKEND"

# Helper: List all /dev/video* devices
list_cameras() {
  for dev in $(ls -1 ${DEVICE_PREFIX}[0-9]* 2>/dev/null | sort -V); do
    idx=${dev##*video}
    if (( idx >= START_IDX )); then
      echo "$dev"
    fi
  done
}

# Main camera loop
for camdev in $(list_cameras); do
  idx=${camdev##*video}
  NAME="camera$idx"
  LOGFILE="$LOG_DIR/$NAME.log"
  OUTFILE="$PRODUCER_ROOT/${NAME}.raw"

  echo "[src.sh] Launching $BACKEND producer for $camdev as $NAME..."

  case "$BACKEND" in
    ffmpeg)
      # Example: output raw frames
      ffmpeg -f v4l2 -i "$camdev" -f rawvideo "$OUTFILE" > "$LOGFILE" 2>&1 &
      ;;
    gstreamer)
      # Example: output to a raw video file
      gst-launch-1.0 v4l2src device="$camdev" ! videoconvert ! filesink location="$OUTFILE" > "$LOGFILE" 2>&1 &
      ;;
    v4l2)
      # Example: cat out all frames
      cat "$camdev" > "$OUTFILE" 2> "$LOGFILE" &
      ;;
    *)
      echo "[src.sh] Unknown backend: $BACKEND"
      ;;
  esac

  echo "Started producer $NAME on $camdev (log: $LOGFILE, out: $OUTFILE)"
done

# Monitor loop: Print current camera state every 10 seconds (optional)
while true; do
  echo "[src.sh] $(date): Active producers:"
  ps aux | grep -E 'ffmpeg|gst-launch|cat' | grep -v grep
  sleep 10
done