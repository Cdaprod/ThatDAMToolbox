# Hardware Capture Refactor Checklist

By swapping in those two files you’ve mostly just moved logic around, not fundamentally changed any public APIs–but there are a few little land-mines you’ll want to check so you don’t accidentally break something downstream:

-----

## 1. Make sure you haven’t renamed or dropped any exported symbols

Your existing CLI (`video hw_list`, `video hw_record`, `video witness_record`) and your REST routes in `routes.py` all expect certain functions or classes to exist in the `video.modules.hwcapture` package:

- `has_hw` (used in `/ws/status`)
- `list_video_devices`
- `get_device_info` (for CLI "info")
- `HWAccelRecorder`
- `record` (imported as `cli_record` in `routes.py`)
- `record_multiple`
- `capture_multiple`
- `stream_jpeg_frames`
- `record_with_witness` (used by the `/hwcapture/witness_record` route)

If you simply replaced only `hwcapture.py` and `ws.py` but left your old `__init__.py` in `video/modules/hwcapture` unchanged, verify that `__init__.py` still does something like:

```python
from .hwcapture import (
    has_hardware_accel as has_hw,
    record, record_multiple, capture_multiple,
    list_video_devices, get_device_info,
    HWAccelRecorder, stream_jpeg_frames,
    record_with_witness,
)
```

**⚠️ Warning**: If you forgot to re-export `record_with_witness` (or aliased `has_hardware_accel` to `has_hw`), your existing routes & CLI will throw `ImportError` or `NameError`.

-----

## 2. Watch for missing imports

In your new `ws.py` you reference:

```python
raise HTTPException(status_code=400, detail=str(e))
```

but you never imported it. Add:

```python
from fastapi import HTTPException
```

at the top, or else any WebRTC setup failure will crash with a `NameError`.

-----

## 3. Behavioral changes you might not spot immediately

### 3.1 Device-list caching

Your `DeviceManager` now caches the list of `/dev/video*` for 30 seconds. If you plug or unplug cameras during that window, `list_devices` and `validate_device` will give you stale info. The old code re-scanned on each request.

### 3.2 Validation vs. fallback

- **Old preview** (`/ws/preview`) would attempt `cv2.VideoCapture` once, then fall back to a "no signal" JPG stream if that failed.
- **New preview** first runs `DeviceManager.validate_device()` (which just does a quick stat + probe), and only if that passes does it spin up your generator. If you had weird devices that OpenCV actually could open but your probe logic rejects, you’ll now immediately get the HTML "no signal" page instead of the old "blank JPG" fallback.

### 3.3 Frame-capture size & quality

You’ve replaced the ffmpeg-driven MJPEG `/hwcapture/stream` in your `routes.py` with the pure-Python `stream_jpeg_frames` inside `preview_mjpeg`. The old `/hwcapture/stream` (in `routes.py`) still uses ffmpeg; your `/ws/preview` is unchanged. But if you ever switch `/hwcapture/stream` over to `stream_jpeg_frames`, note that OpenCV’s `imencode` quality and dimensions may differ slightly from your ffmpeg defaults.

-----

## 4. How to smoke-test before you commit

### 4.1 Module-level sanity

```bash
docker exec -it thatdamtoolbox-video-api-1 python3 - <<'EOF'
from video.modules.hwcapture import (
  has_hw, list_video_devices, get_device_info,
  capture_single_frame, stream_jpeg_frames,
  record, record_multiple, capture_multiple, record_with_witness
)
print("HW accel:", has_hw())
print("Devices:", list_video_devices())
print("Info0:", get_device_info("/dev/video0"))
img = capture_single_frame("/dev/video0")
print("Snapshot:", len(img) if img else "none")
EOF
```

### 4.2 HTTP MJPEG preview

```bash
curl -v "http://localhost:8080/ws/preview?device=/dev/video0&quality=70" \
  --output preview.mjpg && file preview.mjpg
# Should say "JPEG image data"
```

### 4.3 WebSocket "frame"

```bash
printf '{"action":"capture_frame","device":"/dev/video0"}\n' \
  | websocat ws://localhost:8080/ws/camera
# Look for {"event":"frame",…} with a base64 blob.
```

### 4.4 CLI commands

```bash
docker exec -it thatdamtoolbox-video-api-1 video hw_list
docker exec -it thatdamtoolbox-video-api-1 video hw_record --device /dev/video0 --duration 2
docker exec -it thatdamtoolbox-video-api-1 video witness_record --duration 2
```

### 4.5 REST endpoints (simulated)

```bash
curl http://localhost:8080/hwcapture/devices
curl -X POST "http://localhost:8080/hwcapture/record?device=/dev/video0&fname=test.mp4"
# then curl -X DELETE http://localhost:8080/hwcapture/record/<job_id>
curl -X POST http://localhost:8080/hwcapture/witness_record?duration=5
```

-----

## ✅ Final Validation

If all of those pass, you can be confident you didn’t break any of the existing entry-points. The only "gotcha" left is keeping your module’s exports and your FastAPI imports perfectly in sync–once those match, you’ve simply DRY’d away the duplicate capture logic without any real breakage.

-----

## Quick Fix Checklist

- [ ] Verify `__init__.py` exports all required symbols
- [ ] Add missing `HTTPException` import to `ws.py`
- [ ] Test all CLI commands work
- [ ] Test all REST endpoints respond correctly
- [ ] Test WebSocket connections function
- [ ] Verify MJPEG streaming works
- [ ] Check device detection and validation
- [ ] Confirm no import errors in module loading

---
--- 

# Video Device Inspection & Testing Commands

## Commands to run inside your container to thoroughly inspect and test video devices on your host system.

## 1. System Overview & Hardware Detection

### Basic system info

```bash
# System overview
inxi -Fxz

# Just graphics/video hardware
inxi -G

# USB devices (often where webcams appear)
lsusb

# PCI devices (capture cards, etc.)
lspci | grep -i video

# All video-related devices
ls -la /dev/video*

# Device permissions and groups
ls -la /dev/video* /dev/vchiq /dev/dri/*

# Check what groups current user belongs to
id

# Check video group members
getent group video
```

### Kernel modules & drivers

```bash
# Loaded video-related modules
lsmod | grep -E "(video|uvc|usb|v4l|media)"

# Detailed module info for USB Video Class
modinfo uvcvideo

# dmesg for recent video device events
dmesg | grep -i -E "(video|uvc|usb.*video|v4l)" | tail -20
```

## 2. V4L2 (Video4Linux2) Inspection

### Device discovery and capabilities

```bash
# List all V4L2 devices
v4l2-ctl --list-devices

# Detailed info for each device
for dev in /dev/video*; do
  echo "=== $dev ==="
  v4l2-ctl --device=$dev --info
  echo
done

# Get all capabilities for a specific device
v4l2-ctl --device=/dev/video0 --all

# List supported formats and frame sizes
v4l2-ctl --device=/dev/video0 --list-formats-ext

# Show current format settings
v4l2-ctl --device=/dev/video0 --get-fmt-video

# List available controls (brightness, contrast, etc.)
v4l2-ctl --device=/dev/video0 --list-ctrls

# List available frame rates
v4l2-ctl --device=/dev/video0 --list-framerates
```

### Device testing with v4l2

```bash
# Test capture a single frame (saves as raw)
v4l2-ctl --device=/dev/video0 --stream-mmap --stream-count=1 --stream-to=/tmp/test.raw

# Set specific format before capture
v4l2-ctl --device=/dev/video0 --set-fmt-video=width=640,height=480,pixelformat=MJPG
v4l2-ctl --device=/dev/video0 --stream-mmap --stream-count=10 --stream-to=/tmp/test_640x480.raw

# Check what formats work
for fmt in YUYV MJPG H264 RGB3; do
  echo "Testing format: $fmt"
  v4l2-ctl --device=/dev/video0 --set-fmt-video=pixelformat=$fmt 2>&1 | head -1
done
```

## 3. FFmpeg Device Testing

### Probe devices and formats

```bash
# List all video input devices
ffmpeg -f v4l2 -list_devices true -i dummy 2>&1 | grep -A20 "video devices"

# Probe specific device capabilities
ffmpeg -f v4l2 -list_formats all -i /dev/video0

# Show supported pixel formats for device
ffmpeg -f v4l2 -pixel_format list -i /dev/video0 2>&1 | grep -A50 "Supported pixel formats"

# Get detailed info about a device
ffprobe -f v4l2 -i /dev/video0 2>&1 | head -20
```

### Test recording with ffmpeg

```bash
# Quick 5-second test recording (default format)
ffmpeg -f v4l2 -i /dev/video0 -t 5 -y /tmp/test_video0.mp4

# Test with specific format/resolution
ffmpeg -f v4l2 -video_size 640x480 -framerate 30 -i /dev/video0 -t 3 -y /tmp/test_640x480.mp4

# Test MJPEG input (common for USB cameras)
ffmpeg -f v4l2 -input_format mjpeg -video_size 1920x1080 -i /dev/video0 -t 3 -y /tmp/test_mjpeg.mp4

# Test with hardware acceleration (Pi 5)
ffmpeg -f v4l2 -i /dev/video0 -c:v h264_v4l2m2m -t 5 -y /tmp/test_hw_accel.mp4

# Stream to stdout (for testing capture without saving)
timeout 3s ffmpeg -f v4l2 -i /dev/video0 -f null -

# Test multiple devices simultaneously
ffmpeg -f v4l2 -i /dev/video0 -f v4l2 -i /dev/video1 -t 3 -map 0 /tmp/cam0.mp4 -map 1 /tmp/cam1.mp4
```

## 4. OpenCV Testing (Python)

### Quick OpenCV device test

```bash
python3 -c "
import cv2
import sys

# Test each video device
for i in range(10):  # Check video0 through video9
    cap = cv2.VideoCapture(i)
    if cap.isOpened():
        width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        fps = cap.get(cv2.CAP_PROP_FPS)
        fourcc = cap.get(cv2.CAP_PROP_FOURCC)
        
        print(f'/dev/video{i}: {width}x{height} @ {fps}fps, fourcc: {int(fourcc)}')
        
        # Try to read a frame
        ret, frame = cap.read()
        if ret:
            print(f'  ✓ Successfully captured frame: {frame.shape}')
        else:
            print(f'  ✗ Failed to capture frame')
        cap.release()
    else:
        print(f'/dev/video{i}: Not accessible')
"
```

### Test specific device with OpenCV

```bash
python3 -c "
import cv2
import numpy as np

device = '/dev/video0'
cap = cv2.VideoCapture(device)

if not cap.isOpened():
    print(f'Cannot open {device}')
    exit(1)

print('Device opened successfully')
print(f'Backend: {cap.getBackendName()}')

# Get and print properties
props = {
    'WIDTH': cv2.CAP_PROP_FRAME_WIDTH,
    'HEIGHT': cv2.CAP_PROP_FRAME_HEIGHT,
    'FPS': cv2.CAP_PROP_FPS,
    'FOURCC': cv2.CAP_PROP_FOURCC,
    'BRIGHTNESS': cv2.CAP_PROP_BRIGHTNESS,
    'CONTRAST': cv2.CAP_PROP_CONTRAST,
    'SATURATION': cv2.CAP_PROP_SATURATION,
}

for name, prop in props.items():
    value = cap.get(prop)
    print(f'{name}: {value}')

# Capture a few frames
for i in range(5):
    ret, frame = cap.read()
    if ret:
        print(f'Frame {i}: {frame.shape}, dtype: {frame.dtype}')
    else:
        print(f'Frame {i}: Failed to capture')
        break

cap.release()
"
```

## 5. Hardware-Specific Tests (Raspberry Pi)

### Pi Camera & GPU memory

```bash
# Check GPU memory split (Pi-specific)
vcgencmd get_mem gpu

# Pi camera detection
vcgencmd get_camera

# Check for Pi camera in device tree
ls /proc/device-tree/soc/*/camera* 2>/dev/null || echo "No Pi camera found in device tree"

# Check loaded overlays
vcgencmd get_config str | grep dtoverlay

# Temperature and throttling (affects video performance)
vcgencmd measure_temp
vcgencmd get_throttled
```

### Test Pi hardware video encoder

```bash
# Test hardware H.264 encoding
ffmpeg -f v4l2 -i /dev/video0 -c:v h264_v4l2m2m -b:v 2M -t 5 /tmp/test_pi_hw.mp4

# Check encoder capabilities
v4l2-ctl --device=/dev/video10 --list-formats-ext 2>/dev/null || echo "No hardware encoder at video10"
v4l2-ctl --device=/dev/video11 --list-formats-ext 2>/dev/null || echo "No hardware encoder at video11"
```

## 6. Performance & Bandwidth Testing

### Test different formats and measure performance

```bash
# Create test script
cat > /tmp/perf_test.sh << 'EOF'
#!/bin/bash
device=${1:-/dev/video0}
echo "Testing performance for $device"

formats=(YUYV MJPG)
resolutions=("640x480" "1280x720" "1920x1080")

for fmt in "${formats[@]}"; do
  for res in "${resolutions[@]}"; do
    echo "Testing $fmt @ $res"
    timeout 10s ffmpeg -f v4l2 -input_format $fmt -video_size $res -i $device -f null - 2>&1 | 
      grep -E "(fps=|speed=)" | tail -1
    sleep 1
  done
done
EOF

chmod +x /tmp/perf_test.sh
/tmp/perf_test.sh /dev/video0
```

### USB bandwidth check

```bash
# Check USB tree and bandwidth
lsusb -t

# Monitor USB events
udevadm monitor --subsystem-match=usb --property &
# Unplug/replug camera to see events, then kill monitor
```

## 7. Troubleshooting Commands

### Permission and access issues

```bash
# Check if device is busy
lsof /dev/video*

# Test with different user/group
sudo -u appuser v4l2-ctl --device=/dev/video0 --info

# Check udev rules for video devices
udevadm info -a -p $(udevadm info -q path -n /dev/video0)

# Current device permissions and context
stat /dev/video*
```

### Quick diagnostic script

```bash
cat > /tmp/video_diag.sh << 'EOF'
#!/bin/bash
echo "=== Video Device Diagnostic ==="
echo "Date: $(date)"
echo "User: $(whoami) ($(id))"
echo ""

echo "=== Available Devices ==="
ls -la /dev/video* 2>/dev/null || echo "No video devices found"
echo ""

echo "=== V4L2 Device List ==="
v4l2-ctl --list-devices 2>/dev/null || echo "v4l2-ctl failed"
echo ""

echo "=== USB Video Devices ==="
lsusb | grep -i video
echo ""

echo "=== Recent Kernel Messages ==="
dmesg | grep -i video | tail -5
echo ""

echo "=== Process Using Video Devices ==="
lsof /dev/video* 2>/dev/null || echo "No processes using video devices"
EOF

chmod +x /tmp/video_diag.sh
/tmp/video_diag.sh
```

## 8. Container-Specific Checks

### Verify container has access to host devices

```bash
# Check mounted devices
mount | grep -E "/dev/(video|vchiq|dri)"

# Check device cgroup permissions
cat /proc/self/cgroup | grep devices

# Test device access from container user
test -r /dev/video0 && echo "video0 readable" || echo "video0 NOT readable"
test -w /dev/video0 && echo "video0 writable" || echo "video0 NOT writable"

# Check if running in privileged mode
if [ -w /proc/sys ]; then 
    echo "Running in privileged mode"
else 
    echo "Running in non-privileged mode"
fi
```

Use these commands systematically to identify what video devices you have, their capabilities, and any issues preventing proper access or operation.

---
---

# Looking at your screenshots, I can see you have a wealth of video devices available! Your Pi 5 setup is quite impressive:

## What I can see from your output:

### Device Inventory:

- **CSI Camera**: `/dev/video0` (rpi-hevc-dec platform device) - This is likely your Pi Camera
- **USB Cameras**: Multiple OBSBOT Tiny 2 Lite cameras and USB3.0 capture devices
- **Hardware Encoders/Decoders**: video19 (pi-hevc-dec) for hardware H.265 decoding

### Key Findings:

1. **Multiple format support**: Your devices support both MJPG (compressed) and YUYV (uncompressed) formats
1. **High resolution capabilities**: Up to 1920x1080 on several devices
1. **Good frame rate options**: 15-60 fps depending on resolution
1. **Hardware acceleration available**: The Pi’s hardware decoder is present

## Quick analysis commands you should run:​​​​​​​​​​​​​​​​

## Based on your device list, here’s what I recommend testing:

### Priority Testing Order:

1. **`/dev/video0`** - Your CSI camera (Pi Camera) - should be your most reliable
1. **`/dev/video2`** - First OBSBOT camera
1. **`/dev/video3`** - USB capture device

### Optimal settings to try:

```bash
# For Pi Camera (video0) - likely best performance
ffmpeg -f v4l2 -input_format mjpeg -video_size 1280x720 -framerate 30 -i /dev/video0 -t 5 test_picam.mp4

# For OBSBOT cameras - they seem to support high res
ffmpeg -f v4l2 -input_format mjpeg -video_size 1920x1080 -framerate 15 -i /dev/video2 -t 5 test_obsbot.mp4

# Test hardware encoding with Pi Camera
ffmpeg -f v4l2 -i /dev/video0 -c:v h264_v4l2m2m -b:v 4M -t 5 test_hw_encode.mp4
```

### Potential Issues to Watch For:

- **USB bandwidth**: Multiple high-res USB cameras may compete for bandwidth
- **Format compatibility**: Some devices show formats they can’t actually deliver
- **Permission issues**: Make sure your container user can access all devices

Run the quick analysis script above to get a rapid assessment of which devices are working optimally with your current setup!​​​​​​​​​​​​​​​​