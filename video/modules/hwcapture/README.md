# /video/modules/hwcapture/README.md

Now `hwcapture.py` supports multiple cameras including your Insta360 X3 webcam. Here’s how to use it:

**Multi-camera recording:**

```python
import hwcapture

# Record HDMI + USB webcam simultaneously
hwcapture.record_hdmi_and_webcam(
    hdmi_device="/dev/video0",    # Your HDMI-to-CSI
    webcam_device="/dev/video1",  # Your Insta360 X3
    duration=60
)

# Record multiple devices
hwcapture.record_multiple(
    devices=["/dev/video0", "/dev/video1", "/dev/video2"],
    outputs=["hdmi.mp4", "insta360.mp4", "webcam.mp4"],
    duration=120
)

# Multi-angle with processing
hwcapture.capture_multi_angle(
    devices=["/dev/video0", "/dev/video1"],
    add_labels=True  # Labels each stream
)
```

**Command line usage:**

```bash
# List all available cameras
python hwcapture.py --list

# Record HDMI + webcam preset
python hwcapture.py --hdmi-webcam --duration 60

# Manual multi-device recording
python hwcapture.py --devices /dev/video0 /dev/video1 /dev/video2 \
                   --outputs hdmi.mp4 insta360.mp4 webcam.mp4 \
                   --duration 120

# Multi-angle with labels
python hwcapture.py --multi-angle --labels --duration 60
```

**Key features for multi-camera:**

- **Simultaneous recording**: All cameras record in parallel using threading
- **Hardware acceleration**: Each stream uses GPU encoding when available
- **Device auto-detection**: Automatically finds available cameras
- **Labeled streams**: Adds device names to video for identification
- **Separate preview windows**: Each camera gets its own preview window
- **Insta360 X3 support**: Works with any USB UVC device including your 360 camera

The Insta360 X3 in webcam mode will appear as a standard USB video device (probably `/dev/video1` or `/dev/video2`), and the module will handle it just like any other camera with full hardware acceleration.​​​​​​​​​​​​​​​​

## Witness Camera Syncing with `tracker.py`

```shell
# inside the container (or via CLI)
python -m video witness_record --duration 10
# or through REST
curl -X POST "http://pi5.local:8080/hwcapture/witness_record?duration=10"
``` 

**You'll get:**

```output
main_raw.mp4        # original HDMI feed
main_stab.mp4       # witness-stabilised version
``` 