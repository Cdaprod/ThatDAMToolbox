#!/usr/bin/env python3
"""
hwcapture.py - Hardware-accelerated Video Capture

Drop-in module for hardware-accelerated video capture and encoding.
Optimized for HDMI-to-CSI setups with VideoCore VII GPU acceleration.

Quick start:
    import hwcapture
    
    # Direct hardware recording (fastest)
    hwcapture.record("/dev/video0", "output.mp4", duration=60)
    
    # With frame processing
    hwcapture.capture("/dev/video0", "output.mp4", process_func=my_function)
    
    # Check capabilities
    if hwcapture.has_hardware_accel():
        print("GPU acceleration available")

Author: Auto-generated hardware acceleration module
Version: 1.0
"""

import shutil, subprocess, os, tempfile, logging, threading, queue, time
import cv2
import numpy as np

_FFMPEG = shutil.which("ffmpeg") or "/opt/ffmpeg-rpi/bin/ffmpeg"

# Public API functions
def has_hardware_accel():
    """Check if hardware acceleration is available."""
    return _has_vc7()

def record(device="/dev/video0", output="recording.mp4", duration=None, codec="h264"):
    """
    Simple hardware-accelerated recording.
    
    Args:
        device: V4L2 device path (default: /dev/video0)
        output: Output filename
        duration: Recording duration in seconds (None = manual stop)
        codec: Video codec ('h264' or 'hevc')
    """
    recorder = HWAccelRecorder(device, output)
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
    Capture with optional frame processing.
    
    Args:
        device: V4L2 device path
        output: Output filename
        process_func: Optional function to process each frame
        preview: Show preview window
    """
    processor = HWAccelProcessor(device)
    processor.process_stream_hw(output, process_func, preview)

def record_multiple(devices, outputs, duration=None, codec="h264"):
    """
    Record from multiple devices simultaneously.
    
    Args:
        devices: List of device paths ["/dev/video0", "/dev/video1"]
        outputs: List of output filenames ["cam1.mp4", "cam2.mp4"]
        duration: Recording duration in seconds (None = manual stop)
        codec: Video codec ('h264' or 'hevc')
    """
    if len(devices) != len(outputs):
        raise ValueError("Number of devices must match number of outputs")
    
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
            recorder.stop_recording()

def capture_multiple(devices, outputs, process_funcs=None, preview=True):
    """
    Capture from multiple devices with optional processing.
    
    Args:
        devices: List of device paths
        outputs: List of output filenames
        process_funcs: List of processing functions (or None for no processing)
        preview: Show preview windows
    """
    if len(devices) != len(outputs):
        raise ValueError("Number of devices must match number of outputs")
    
    if process_funcs and len(process_funcs) != len(devices):
        raise ValueError("Number of process functions must match number of devices")
    
    # Create processors and start capture threads
    processors = []
    threads = []
    
    for i, (device, output) in enumerate(devices, outputs):
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

def list_video_devices():
    """List all available video devices."""
    devices = []
    for i in range(10):  # Check /dev/video0 through /dev/video9
        device_path = f"/dev/video{i}"
        if os.path.exists(device_path):
            info = _probe_v4l2_device(device_path)
            if info[0]:  # If we can get width/height
                devices.append({
                    'path': device_path,
                    'width': info[0],
                    'height': info[1],
                    'fps': info[2]
                })
    return devices

def get_device_info(device="/dev/video0"):
    """Get device capabilities."""
    return _probe_v4l2_device(device)

# Internal implementation
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
    """Get resolution and format info from V4L2 device."""
    try:
        cap = cv2.VideoCapture(device)
        if not cap.isOpened():
            return None, None, None
        
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        cap.release()
        
        return width, height, fps
    except Exception as e:
        logging.error(f"Failed to probe {device}: {e}")
        return None, None, None

class HWAccelRecorder:
    """Hardware-accelerated recorder for live video streams."""
    
    def __init__(self, device="/dev/video0", output_file="output.mp4"):
        self.device = device
        self.output_file = output_file
        self.recording = False
        self.process = None
        
        # Probe device capabilities
        self.width, self.height, self.fps = _probe_v4l2_device(device)
        if not all([self.width, self.height, self.fps]):
            raise RuntimeError(f"Cannot probe {device}")
        
        logging.info(f"Device: {device}, Resolution: {self.width}x{self.height}, FPS: {self.fps}")
    
    def start_recording_hw(self, vcodec="h264"):
        """Start hardware-accelerated recording directly from V4L2 device."""
        if not _has_vc7():
            raise RuntimeError("VideoCore VII not available")
        
        codec_map = {
            "h264": "h264_v4l2m2m",
            "hevc": "hevc_v4l2request"
        }
        
        # Direct V4L2 to file encoding - bypasses OpenCV entirely
        cmd = [
            _FFMPEG, "-y",
            "-f", "v4l2",
            "-framerate", str(int(self.fps)),
            "-video_size", f"{self.width}x{self.height}",
            "-i", self.device,
            "-c:v", codec_map[vcodec],
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-b:v", "5M",  # 5 Mbps bitrate
            self.output_file
        ]
        
        logging.info("Starting HW recording: %s", " ".join(cmd))
        self.process = subprocess.Popen(cmd, stderr=subprocess.DEVNULL)
        self.recording = True
        return self.process
    
    def stop_recording(self):
        """Stop recording."""
        if self.process and self.recording:
            self.process.terminate()
            self.process.wait()
            self.recording = False
            logging.info("Recording stopped")

class HWAccelProcessor:
    """Process live video with hardware acceleration."""
    
    def __init__(self, device="/dev/video0"):
        self.device = device
        self.width, self.height, self.fps = _probe_v4l2_device(device)
        self.stop_flag = threading.Event()
        
    def process_stream_hw(self, output_file, process_func=None, preview=True):
        """
        Process live stream with optional frame processing.
        Uses hardware encoding for output.
        """
        if not _has_vc7():
            logging.warning("No HW acceleration, falling back to OpenCV")
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
        
        # Set preview window name to device name for multi-camera
        window_name = f"Preview - {self.device}"
        
        try:
            while not self.stop_flag.is_set():
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Optional frame processing
                if process_func:
                    frame = process_func(frame)
                
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
                        
        finally:
            cap.release()
            encoder.stdin.close()
            encoder.wait()
            if preview:
                cv2.destroyWindow(window_name)
    
    def stop(self):
        """Stop processing."""
        self.stop_flag.set()
        
    def _process_stream_opencv(self, output_file, process_func=None, preview=True):
        """Fallback to pure OpenCV processing."""
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
                    frame = process_func(frame)
                
                out.write(frame)
                if preview:
                    cv2.imshow(window_name, frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
        finally:
            cap.release()
            out.release()
            if preview:
                cv2.destroyWindow(window_name)

# Example usage and utilities
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

# Pre-configured multi-camera setups
def record_hdmi_and_webcam(hdmi_device="/dev/video0", webcam_device="/dev/video1", 
                          duration=None, outputs=None):
    """
    Convenient function for recording HDMI capture + USB webcam simultaneously.
    
    Args:
        hdmi_device: HDMI-to-CSI device path
        webcam_device: USB webcam device path
        duration: Recording duration in seconds
        outputs: Custom output filenames [hdmi_file, webcam_file]
    """
    if outputs is None:
        outputs = ["hdmi_capture.mp4", "webcam_capture.mp4"]
    
    devices = [hdmi_device, webcam_device]
    
    print(f"Recording from {hdmi_device} (HDMI) and {webcam_device} (Webcam)")
    print("Available devices:")
    for device in list_video_devices():
        print(f"  {device['path']}: {device['width']}x{device['height']} @ {device['fps']}fps")
    
    record_multiple(devices, outputs, duration)

def capture_multi_angle(devices=None, duration=None, add_labels=True):
    """
    Multi-angle capture with device labels.
    
    Args:
        devices: List of device paths (auto-detects if None)
        duration: Recording duration
        add_labels: Add device labels to footage
    """
    if devices is None:
        available = list_video_devices()
        devices = [dev['path'] for dev in available]
        if not devices:
            raise RuntimeError("No video devices found")
    
    outputs = [f"angle_{i+1}_{os.path.basename(device)}.mp4" 
              for i, device in enumerate(devices)]
    
    process_funcs = None
    if add_labels:
        process_funcs = [add_device_label(os.path.basename(device)) for device in devices]
    
    print(f"Recording {len(devices)} angles:")
    for device, output in zip(devices, outputs):
        print(f"  {device} → {output}")
    
    if duration:
        # Use threaded capture for timed recording
        capture_multiple(devices, outputs, process_funcs, preview=True)
    else:
        # Use direct recording for continuous
        record_multiple(devices, outputs, duration, codec="h264")

# Command line interface
def main():
    """Command line interface for quick testing."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Hardware-accelerated video capture")
    parser.add_argument("--device", default="/dev/video0", help="Video device")
    parser.add_argument("--devices", nargs="+", help="Multiple video devices")
    parser.add_argument("--output", default="recording.mp4", help="Output file")
    parser.add_argument("--outputs", nargs="+", help="Multiple output files")
    parser.add_argument("--duration", type=int, help="Recording duration (seconds)")
    parser.add_argument("--list", action="store_true", help="List available devices")
    parser.add_argument("--info", action="store_true", help="Show device info")
    parser.add_argument("--timestamp", action="store_true", help="Add timestamp overlay")
    parser.add_argument("--labels", action="store_true", help="Add device labels")
    parser.add_argument("--hdmi-webcam", action="store_true", help="Record HDMI + webcam")
    parser.add_argument("--multi-angle", action="store_true", help="Multi-angle capture")
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    
    if args.list:
        devices = list_video_devices()
        print("Available video devices:")
        for device in devices:
            print(f"  {device['path']}: {device['width']}x{device['height']} @ {device['fps']}fps")
        return
    
    if args.info:
        width, height, fps = get_device_info(args.device)
        print(f"Device: {args.device}")
        print(f"Resolution: {width}x{height}")
        print(f"FPS: {fps}")
        print(f"Hardware acceleration: {'Available' if has_hardware_accel() else 'Not available'}")
        return
    
    if args.hdmi_webcam:
        record_hdmi_and_webcam(duration=args.duration)
        return
    
    if args.multi_angle:
        capture_multi_angle(args.devices, args.duration, args.labels)
        return
    
    # Multi-device recording
    if args.devices:
        if args.outputs and len(args.outputs) != len(args.devices):
            print("Error: Number of outputs must match number of devices")
            return
        
        outputs = args.outputs or [f"recording_{i}.mp4" for i in range(len(args.devices))]
        
        process_funcs = None
        if args.labels:
            process_funcs = [add_device_label(os.path.basename(device)) for device in args.devices]
        elif args.timestamp:
            process_funcs = [add_timestamp for _ in args.devices]
        
        if process_funcs:
            capture_multiple(args.devices, outputs, process_funcs)
        else:
            record_multiple(args.devices, outputs, args.duration)
        return
    
    # Single device recording
    if args.timestamp:
        capture(args.device, args.output, add_timestamp)
    else:
        record(args.device, args.output, args.duration)

# --- at top ---
from .tracker import WitnessTracker

# --- new helper ---
def record_with_witness(main_dev="/dev/video0",
                        witness_dev="/dev/video1",
                        out_main="main_raw.mp4",
                        out_corr="main_stab.mp4",
                        duration=60):
    """
    • Captures main HDMI feed (raw)           → out_main
    • Captures witness (Insta360) feed
    • Applies 2-D affine from witness to main → out_corr
    """
    cap_main  = cv2.VideoCapture(main_dev)
    cap_wit   = cv2.VideoCapture(witness_dev)

    w  = int(cap_main.get(cv2.CAP_PROP_FRAME_WIDTH))
    h  = int(cap_main.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap_main.get(cv2.CAP_PROP_FPS) or 30.0

    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    vw_raw = cv2.VideoWriter(out_main, fourcc, fps, (w, h))
    vw_stb = cv2.VideoWriter(out_corr, fourcc, fps, (w, h))

    tracker = WitnessTracker()

    start = time.time()
    while time.time() - start < duration:
        ok1, frm_main = cap_main.read()
        ok2, frm_wit  = cap_wit.read()
        if not (ok1 and ok2):
            break

        M = tracker.update(frm_wit)            # 2×3 affine
        stabilised = cv2.warpAffine(frm_main, M, (w, h),
                                    flags=cv2.INTER_LINEAR,
                                    borderMode=cv2.BORDER_REPLICATE)

        vw_raw.write(frm_main)
        vw_stb.write(stabilised)

        # OPTIONAL live preview
        cv2.imshow("raw", frm_main)
        cv2.imshow("stabilised", stabilised)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap_main.release(); cap_wit.release()
    vw_raw.release();  vw_stb.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()