#!/usr/bin/env python3
"""
video/module/hwcapture.py - Hardware-accelerated Video Capture

Enhanced with better abstractions for WebSocket layer integration.
Provides unified device management and frame capture APIs.

Author: Auto-generated hardware acceleration module
Version: 1.1 - DRY Refactored
"""

import shutil, subprocess, os, tempfile, logging, threading, queue, time
import cv2
import numpy as np
from typing import Optional, List, Dict, Generator, Any
from contextlib import contextmanager

_FFMPEG = shutil.which("ffmpeg") or "/opt/ffmpeg-rpi/bin/ffmpeg"
_log = logging.getLogger("video.hwcapture")

# ──────────── Enhanced Device Management ────────────────
class DeviceInfo:
    """Structured device information."""
    def __init__(self, path: str, width: int, height: int, fps: float):
        self.path = path
        self.width = width
        self.height = height
        self.fps = fps
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'path': self.path,
            'width': self.width,
            'height': self.height,
            'fps': self.fps
        }

class DeviceManager:
    """Centralized device management with caching."""
    
    _device_cache: Optional[List[DeviceInfo]] = None
    _cache_timestamp: float = 0
    _cache_ttl: float = 30.0  # 30 second cache
    
    @classmethod
    def get_devices(cls, force_refresh: bool = False) -> List[DeviceInfo]:
        """Get all available devices with optional caching."""
        now = time.time()
        
        if (force_refresh or 
            cls._device_cache is None or 
            now - cls._cache_timestamp > cls._cache_ttl):
            
            cls._device_cache = cls._scan_devices()
            cls._cache_timestamp = now
            _log.debug(f"Device cache refreshed: {len(cls._device_cache)} devices")
        
        return cls._device_cache
    
    @classmethod
    def _scan_devices(cls) -> List[DeviceInfo]:
        """Scan for available V4L2 devices."""
        devices = []
        for i in range(10):  # Check /dev/video0 through /dev/video9
            device_path = f"/dev/video{i}"
            if os.path.exists(device_path):
                width, height, fps = _probe_v4l2_device(device_path)
                if width and height:  # Valid device
                    devices.append(DeviceInfo(device_path, width, height, fps))
        return devices
    
    @classmethod
    def validate_device(cls, device_path: str) -> bool:
        """Check if device exists and is accessible."""
        devices = cls.get_devices()
        return any(dev.path == device_path for dev in devices)
    
    @classmethod
    def get_device_info(cls, device_path: str) -> Optional[DeviceInfo]:
        """Get info for specific device."""
        devices = cls.get_devices()
        return next((dev for dev in devices if dev.path == device_path), None)

# ──────────── Frame Capture Utilities ────────────────
class FrameCapture:
    """Managed frame capture with proper resource handling."""
    
    def __init__(self, device: str):
        self.device = device
        self.cap = None
        
        if not DeviceManager.validate_device(device):
            raise ValueError(f"Invalid device: {device}")
    
    @contextmanager
    def _get_capture(self):
        """Context manager for OpenCV capture."""
        self.cap = cv2.VideoCapture(self.device)
        try:
            if not self.cap.isOpened():
                raise RuntimeError(f"Cannot open device: {self.device}")
            yield self.cap
        finally:
            if self.cap:
                self.cap.release()
                self.cap = None
    
    def capture_single_frame(self, quality: int = 80) -> Optional[bytes]:
        """Capture a single JPEG frame."""
        try:
            with self._get_capture() as cap:
                ret, frame = cap.read()
                if not ret or frame is None:
                    return None
                
                _, jpg = cv2.imencode('.jpg', frame, 
                                    [cv2.IMWRITE_JPEG_QUALITY, quality])
                return jpg.tobytes()
        except Exception as e:
            _log.error(f"Frame capture failed for {self.device}: {e}")
            return None
    
    def stream_frames(self, quality: int = 80) -> Generator[bytes, None, None]:
        """Generator for continuous frame streaming."""
        fallback_frame = self._create_fallback_frame()
        
        try:
            with self._get_capture() as cap:
                while True:
                    ret, frame = cap.read()
                    if not ret or frame is None:
                        yield fallback_frame
                        time.sleep(1)
                        continue
                    
                    _, jpg = cv2.imencode('.jpg', frame, 
                                        [cv2.IMWRITE_JPEG_QUALITY, quality])
                    yield jpg.tobytes()
        except Exception as e:
            _log.error(f"Stream failed for {self.device}: {e}")
            yield fallback_frame
    
    def _create_fallback_frame(self) -> bytes:
        """Create a 'No Signal' fallback frame."""
        blank = np.zeros((360, 640, 3), dtype=np.uint8)
        cv2.putText(
            blank, "No Signal",
            (int(blank.shape[1] * 0.1), int(blank.shape[0] * 0.5)),
            cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 0, 255), 3, cv2.LINE_AA
        )
        _, jpg = cv2.imencode('.jpg', blank)
        return jpg.tobytes()

# ──────────── Public API Functions (Enhanced) ────────────────
def has_hardware_accel():
    """Check if hardware acceleration is available."""
    return _has_vc7()

def list_video_devices() -> List[Dict[str, Any]]:
    """List all available video devices."""
    devices = DeviceManager.get_devices()
    return [dev.to_dict() for dev in devices]

def validate_device(device: str) -> bool:
    """Validate that a device exists and is accessible."""
    return DeviceManager.validate_device(device)

def get_device_info(device: str = "/dev/video0") -> Optional[Dict[str, Any]]:
    """Get device capabilities."""
    info = DeviceManager.get_device_info(device)
    return info.to_dict() if info else None

def capture_single_frame(device: str, quality: int = 80) -> Optional[bytes]:
    """Capture a single frame from device."""
    capture = FrameCapture(device)
    return capture.capture_single_frame(quality)

def stream_jpeg_frames(device: str = "/dev/video0", quality: int = 80) -> Generator[bytes, None, None]:
    """
    Generator yielding JPEG-encoded frames from device.
    Enhanced with proper error handling and fallback frames.
    """
    capture = FrameCapture(device)
    yield from capture.stream_frames(quality)

def record(device="/dev/video0", output="rec.mp4", duration=None,
           codec="h264", timecode: str = None):
    """
    Simple hardware-accelerated recording with device validation.
    """
    if not validate_device(device):
        raise ValueError(f"Invalid device: {device}")
    
    recorder = HWAccelRecorder(device, output, timecode)
    try:
        recorder.start_recording_hw(codec)
        if duration:
            time.sleep(duration)
        else:
            input("Press Enter to stop recording...")
    finally:
        recorder.stop_recording()

def capture(device="/dev/video0", output="capture.mp4", process_func=None, preview=True):
    """
    Capture with optional frame processing and device validation.
    """
    if not validate_device(device):
        raise ValueError(f"Invalid device: {device}")
    
    processor = HWAccelProcessor(device)
    processor.process_stream_hw(output, process_func, preview)

def record_multiple(devices, outputs, duration=None, codec="h264"):
    """
    Record from multiple devices simultaneously with validation.
    """
    if len(devices) != len(outputs):
        raise ValueError("Number of devices must match number of outputs")
    
    # Validate all devices first
    for device in devices:
        if not validate_device(device):
            raise ValueError(f"Invalid device: {device}")
    
    recorders = []
    try:
        # Start all recorders
        for device, output in zip(devices, outputs):
            recorder = HWAccelRecorder(device, output)
            recorder.start_recording_hw(codec)
            recorders.append(recorder)
        
        # Wait for completion
        if duration:
            time.sleep(duration)
        else:
            input("Press Enter to stop all recordings...")
            
    finally:
        # Stop all recorders
        for recorder in recorders:
            try:
                recorder.stop_recording()
            except Exception as e:
                _log.error(f"Error stopping recorder: {e}")

def capture_multiple(devices, outputs, process_funcs=None, preview=True):
    """
    Capture from multiple devices with optional processing and validation.
    """
    if len(devices) != len(outputs):
        raise ValueError("Number of devices must match number of outputs")
    
    if process_funcs and len(process_funcs) != len(devices):
        raise ValueError("Number of process functions must match number of devices")
    
    # Validate all devices first
    for device in devices:
        if not validate_device(device):
            raise ValueError(f"Invalid device: {device}")
    
    # Create processors and start capture threads
    processors = []
    threads = []
    
    for i, (device, output) in enumerate(zip(devices, outputs)):
        processor = HWAccelProcessor(device)
        process_func = process_funcs[i] if process_funcs else None
        
        # Each camera runs in its own thread
        thread = threading.Thread(
            target=processor.process_stream_hw,
            args=(output, process_func, preview),
            name=f"Camera-{i}"
        )
        thread.daemon = True
        threads.append(thread)
        processors.append(processor)
    
    # Start all threads
    for thread in threads:
        thread.start()
    
    # Wait for all to complete
    try:
        for thread in threads:
            thread.join()
    except KeyboardInterrupt:
        logging.info("Stopping all captures...")

# ──────────── Internal implementation (unchanged but enhanced) ────────────────
def _has_vc7():
    """Detect usable v4l2_request encoders."""
    if not os.path.exists(_FFMPEG):
        return False
    try:
        out = subprocess.check_output([_FFMPEG, "-hide_banner", "-encoders"],
                                      text=True, stderr=subprocess.DEVNULL)
        return "h264_v4l2m2m" in out or "hevc_v4l2request" in out
    except:
        return False

def _probe_v4l2_device(device="/dev/video0"):
    """Get resolution and format info from V4L2 device with better error handling."""
    try:
        cap = cv2.VideoCapture(device)
        if not cap.isOpened():
            return None, None, None
        
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0  # Default FPS if not available
        
        cap.release()
        return width, height, fps
        
    except Exception as e:
        _log.error(f"Failed to probe {device}: {e}")
        return None, None, None

class HWAccelRecorder:
    """Hardware-accelerated recorder for live video streams (enhanced)."""
    
    def __init__(self, device="/dev/video0", output_file="output.mp4",
                 metadata_timecode: str = None):
        self.device = device
        self.output_file = output_file
        self.metadata_timecode = metadata_timecode
        self.recording = False
        self.process = None
        
        # Validate device first
        if not validate_device(device):
            raise ValueError(f"Invalid device: {device}")
        
        # Get device info
        device_info = DeviceManager.get_device_info(device)
        if not device_info:
            raise RuntimeError(f"Cannot get info for {device}")
        
        self.width = device_info.width
        self.height = device_info.height
        self.fps = device_info.fps
        
        _log.info(f"Device: {device}, Resolution: {self.width}x{self.height}, FPS: {self.fps}")
    
    def start_recording_hw(self, vcodec="h264"):
        if not _has_vc7():
            raise RuntimeError("VideoCore VII not available")
        
        codec_map = {"h264":"h264_v4l2m2m","hevc":"hevc_v4l2request"}
        
        cmd = [_FFMPEG, "-y"]
        
        # Add timecode if provided
        if self.metadata_timecode:
            cmd += ["-timecode", self.metadata_timecode]
        
        cmd += [
            "-f", "v4l2",
            "-framerate", str(int(self.fps)),
            "-video_size", f"{self.width}x{self.height}",
            "-i", self.device,
            "-c:v", codec_map[vcodec],
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-b:v", "5M",
            self.output_file
        ]
        
        _log.info("Starting HW recording: %s", " ".join(cmd))
        self.process = subprocess.Popen(cmd, stderr=subprocess.DEVNULL)
        self.recording = True
        return self.process
    
    def stop_recording(self):
        """Stop recording with enhanced error handling."""
        if self.process and self.recording:
            try:
                self.process.terminate()
                self.process.wait(timeout=5)  # Wait up to 5 seconds
            except subprocess.TimeoutExpired:
                _log.warning("Recording process didn't terminate gracefully, killing")
                self.process.kill()
                self.process.wait()
            finally:
                self.process = None
                self.recording = False
                _log.info("Recording stopped")

class HWAccelProcessor:
    """Process live video with hardware acceleration (enhanced)."""
    
    def __init__(self, device="/dev/video0"):
        self.device = device
        self.stop_flag = threading.Event()
        
        # Validate device and get info
        if not validate_device(device):
            raise ValueError(f"Invalid device: {device}")
        
        device_info = DeviceManager.get_device_info(device)
        if not device_info:
            raise RuntimeError(f"Cannot get info for {device}")
        
        self.width = device_info.width
        self.height = device_info.height
        self.fps = device_info.fps
        
    def process_stream_hw(self, output_file, process_func=None, preview=True):
        """Process live stream with optional frame processing and enhanced error handling."""
        if not _has_vc7():
            _log.warning("No HW acceleration, falling back to OpenCV")
            return self._process_stream_opencv(output_file, process_func, preview)
        
        # Set up hardware encoder process
        cmd_out = [
            _FFMPEG, "-y",
            "-f", "rawvideo",
            "-pix_fmt", "bgr24",
            "-s", f"{self.width}x{self.height}",
            "-r", str(int(self.fps)),
            "-i", "-",  # stdin
            "-c:v", "h264_v4l2m2m",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            output_file
        ]
        
        encoder = subprocess.Popen(cmd_out, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
        
        # OpenCV for capture and processing
        cap = cv2.VideoCapture(self.device)
        window_name = f"Preview - {self.device}"
        
        try:
            while not self.stop_flag.is_set():
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Optional frame processing
                if process_func:
                    try:
                        frame = process_func(frame)
                    except Exception as e:
                        _log.error(f"Frame processing error: {e}")
                
                # Send to hardware encoder
                try:
                    encoder.stdin.write(frame.tobytes())
                except BrokenPipeError:
                    break
                
                # Optional preview
                if preview:
                    cv2.imshow(window_name, frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                        
        except Exception as e:
            _log.error(f"Processing error: {e}")
        finally:
            cap.release()
            if encoder.stdin:
                encoder.stdin.close()
            encoder.wait()
            if preview:
                cv2.destroyWindow(window_name)
    
    def stop(self):
        """Stop processing."""
        self.stop_flag.set()
        
    def _process_stream_opencv(self, output_file, process_func=None, preview=True):
        """Fallback to pure OpenCV processing with enhanced error handling."""
        cap = cv2.VideoCapture(self.device)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_file, fourcc, self.fps, (self.width, self.height))
        
        window_name = f"Preview - {self.device}"
        
        try:
            while not self.stop_flag.is_set():
                ret, frame = cap.read()
                if not ret:
                    break
                
                if process_func:
                    try:
                        frame = process_func(frame)
                    except Exception as e:
                        _log.error(f"Frame processing error: {e}")
                
                out.write(frame)
                if preview:
                    cv2.imshow(window_name, frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
        except Exception as e:
            _log.error(f"OpenCV processing error: {e}")
        finally:
            cap.release()
            out.release()
            if preview:
                cv2.destroyWindow(window_name)

# ──────────── Enhanced utilities and examples ────────────────
def add_timestamp(frame):
    """Example frame processor: adds timestamp overlay."""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    cv2.putText(frame, timestamp, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 
               1, (0, 255, 0), 2)
    return frame

def add_fps_counter(frame, fps_counter=[0, time.time()]):
    """Example frame processor: adds FPS counter."""
    fps_counter[0] += 1
    elapsed = time.time() - fps_counter[1]
    if elapsed > 1.0:
        fps = fps_counter[0] / elapsed
        fps_counter[0] = 0
        fps_counter[1] = time.time()
        cv2.putText(frame, f"FPS: {fps:.1f}", (10, 70), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)
    return frame

def add_device_label(device_name):
    """Create a frame processor that adds device label."""
    def label_processor(frame):
        cv2.putText(frame, device_name, (10, frame.shape[0] - 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        return frame
    return label_processor

# ──────────── Witness tracking integration ────────────────
from .tracker import WitnessTracker

def record_with_witness(main_dev="/dev/video0",
                        witness_dev="/dev/video1",
                        out_main="main_raw.mp4",
                        out_corr="main_stab.mp4",
                        duration=60):
    """Record main feed with witness-based stabilization."""
    # Validate devices
    if not validate_device(main_dev):
        raise ValueError(f"Invalid main device: {main_dev}")
    if not validate_device(witness_dev):
        raise ValueError(f"Invalid witness device: {witness_dev}")
    
    cap_main = cv2.VideoCapture(main_dev)
    cap_wit = cv2.VideoCapture(witness_dev)

    try:
        main_info = DeviceManager.get_device_info(main_dev)
        w, h, fps = main_info.width, main_info.height, main_info.fps

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        vw_raw = cv2.VideoWriter(out_main, fourcc, fps, (w, h))
        vw_stb = cv2.VideoWriter(out_corr, fourcc, fps, (w, h))

        tracker = WitnessTracker()

        start = time.time()
        while time.time() - start < duration:
            ok1, frm_main = cap_main.read()
            ok2, frm_wit = cap_wit.read()
            if not (ok1 and ok2):
                break

            M = tracker.update(frm_wit)
            stabilised = cv2.warpAffine(frm_main, M, (w, h),
                                        flags=cv2.INTER_LINEAR,
                                        borderMode=cv2.BORDER_REPLICATE)

            vw_raw.write(frm_main)
            vw_stb.write(stabilised)

            # Optional live preview
            cv2.imshow("raw", frm_main)
            cv2.imshow("stabilised", stabilised)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

    finally:
        cap_main.release()
        cap_wit.release()
        vw_raw.release()
        vw_stb.release()
        cv2.destroyAllWindows()

# ──────────── Command line interface (enhanced) ────────────────
def main():
    """Enhanced command line interface."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Hardware-accelerated video capture")
    parser.add_argument("--device", default="/dev/video0", help="Video device")
    parser.add_argument("--devices", nargs="+", help="Multiple video devices")
    parser.add_argument("--output", default="recording.mp4", help="Output file")
    parser.add_argument("--outputs", nargs="+", help="Multiple output files")
    parser.add_argument("--duration", type=int, help="Recording duration (seconds)")
    parser.add_argument("--list", action="store_true", help="List available devices")
    parser.add_argument("--info", action="store_true", help="Show device info")
    parser.add_argument("--validate", help="Validate specific device")
    parser.add_argument("--refresh-cache", action="store_true", help="Refresh device cache")
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    
    if args.refresh_cache:
        DeviceManager.get_devices(force_refresh=True)
        print("Device cache refreshed")
        return
    
    if args.validate:
        is_valid = validate_device(args.validate)
        print(f"Device {args.validate}: {'Valid' if is_valid else 'Invalid'}")
        return
    
    if args.list:
        devices = list_video_devices()
        print("Available video devices:")
        for device in devices:
            print(f"  {device['path']}: {device['width']}x{device['height']} @ {device['fps']}fps")
        return
    
    if args.info:
        info = get_device_info(args.device)
        if info:
            print(f"Device: {args.device}")
            print(f"Resolution: {info['width']}x{info['height']}")
            print(f"FPS: {info['fps']}")
            print(f"Hardware acceleration: {'Available' if has_hardware_accel() else 'Not available'}")
        else:
            print(f"Device {args.device} not found or invalid")
        return
    
    # Rest of main() function remains the same...
    # (record, capture, multi-device operations)

if __name__ == "__main__":
    main()