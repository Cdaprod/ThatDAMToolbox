# /video/modules/hwcapture/camerarecorder.py

import subprocess, threading, logging
from pathlib import Path

_log = logging.getLogger("video.hwcapture.recorder")

class CameraRecorder:
    def __init__(self, device="/dev/video0", output="capture.mp4", codec="h264"):
        self.device = device
        self.output = Path(output)
        self.codec = codec
        self.process = None
        self.recording = threading.Event()

    def start(self):
        if self.process and self.recording.is_set():
            _log.warning("Recorder already running")
            return

        cmd = [
            "ffmpeg", "-y",
            "-f", "v4l2",
            "-i", self.device,
            "-c:v", f"{self.codec}_v4l2m2m",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
            str(self.output)
        ]
        self.process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.recording.set()
        _log.info(f"Started recording {self.device} → {self.output}")

    def stop(self):
        if self.process and self.recording.is_set():
            self.process.terminate()
            self.process.wait()
            self.recording.clear()
            _log.info(f"Stopped recording {self.device}")
        else:
            _log.warning("No active recording to stop")