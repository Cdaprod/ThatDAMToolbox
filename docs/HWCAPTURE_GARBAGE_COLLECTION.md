Looking at your video capture/streaming code, here are the key garbage collection optimizations for your specific use case:

## Major GC Issues in Your Code

**1. Frame Buffer Allocation in CameraTrack.recv()**

```python
# CURRENT - creates new VideoFrame every call (60fps = 60 allocations/sec)
vframe = VideoFrame.from_ndarray(frame, format="bgr24")

# OPTIMIZE - reuse frame objects
class CameraTrack(VideoStreamTrack):
    def __init__(self, device: str, width: int, height: int, fps: int):
        super().__init__()
        # Pre-allocate reusable frame buffer
        self._frame_buffer = np.zeros((height, width, 3), dtype=np.uint8)
        self._video_frame = None
        # ... rest of init
```

**2. OpenCV Frame Memory Management**

```python
# Your cv2.VideoCapture.read() creates new numpy arrays each call
ret, frame = self.cap.read()  # New allocation every frame

# OPTIMIZE - reuse buffers where possible, clear references immediately
async def recv(self) -> VideoFrame:
    ret, frame = self.cap.read()
    if not ret:
        raise asyncio.CancelledError
    
    # Process and convert immediately
    vframe = VideoFrame.from_ndarray(frame, format="bgr24")
    # Clear the OpenCV frame reference ASAP
    del frame  # Explicit cleanup
    
    vframe.pts = self.pts
    self.pts += self.interval_us
    return vframe
```

**3. JSON Message Allocations in WebSocket**

```python
# CURRENT - creates new dict objects for every message
await ws.send_json({"event":"error","data":"invalid JSON"})

# OPTIMIZE - pre-create common response templates
class WebSocketResponses:
    ERROR_INVALID_JSON = {"event": "error", "data": "invalid JSON"}
    ERROR_ALREADY_RECORDING = {"event": "error", "data": "Already recording"}
    
    @staticmethod
    def recording_started(filename):
        # Still need to create these dynamically, but minimize object creation
        return {"event": "recording_started", "data": {"file": filename}}
```

**4. Subprocess Memory Leaks in HWAccelRecorder**

```python
def stop_recording(self):
    if self.process and self.recording:
        self.process.terminate()
        self.process.wait()
        # ADD: Clear the process reference to help GC
        self.process = None  
        self.recording = False
```

**5. Generator Memory Management in MJPEG Streaming**

```python
def _mjpeg_generator(cmd: list[str]):
    # Your current implementation is actually pretty good
    # But ensure cleanup on generator exit
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    try:
        while True:
            size_bytes = proc.stdout.read(2)
            if not size_bytes:
                break
            size = int.from_bytes(size_bytes, "big")
            jpg = proc.stdout.read(size)
            
            # Yield immediately, don't accumulate frames
            yield boundary + b"\r\n" + b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
            
            # Clear the jpg reference to help GC
            del jpg
    finally:
        proc.terminate()
        proc.wait()
```

## Critical Optimizations for Your 4K60 Pipeline

**Memory Pool for Video Frames:**

```python
class FramePool:
    def __init__(self, width, height, pool_size=10):
        self.pool = queue.Queue()
        for _ in range(pool_size):
            self.pool.put(np.zeros((height, width, 3), dtype=np.uint8))
    
    def get_frame(self):
        try:
            return self.pool.get_nowait()
        except queue.Empty:
            # Pool exhausted, create new (should be rare)
            return np.zeros((height, width, 3), dtype=np.uint8)
    
    def return_frame(self, frame):
        if not self.pool.full():
            self.pool.put(frame)
```

**Explicit Cleanup in Long-Running Operations:**

```python
async def _start_record(cmd: Dict[str,Any], ws: WebSocket):
    # ... existing code ...
    
    # Force garbage collection before starting intensive operation
    import gc
    gc.collect()  # Clear any accumulated garbage before recording
    
    rec = HWAccelRecorder(device=device, output_file=filename)
    _recorder = rec
```

The biggest impact will come from reducing frame allocations in your 60fps video pipeline - that’s 60 new numpy arrays per second that need to be garbage collected. Pre-allocating buffers and reusing them will eliminate most of your GC pressure.​​​​​​​​​​​​​​​​


Ok how are the multiple feeds handled when it comes to recording? It’s not doing something strange like recording them all at the same time or something is it?


Right now our WebSocket API only ever spins up one HWAccelRecorder at a time (stored in that _recorder global). So:
	1.	Single‐feed recording
When you send

{ action: "start_record", device: "/dev/video0", filename: "foo.mp4" }

we create one HWAccelRecorder("/dev/video0", "foo.mp4") and kick off its hardware encoder. Any further "start_record" calls before you "stop_record" will simply error out with "Already recording."

	2.	Switching feeds
If you use our "select_stream" action to point at /dev/video1, that only affects the live‐preview (CameraTrack) used for WebRTC or MJPEG. It doesn’t automatically spawn a second recorder. You’d still need to explicitly call

{ action: "start_record", device: "/dev/video1", filename: "bar.mp4" }

once you’ve stopped the first recorder.

	3.	Recording multiple feeds in parallel
If you do want true multi‐camera simultaneous recording, you have two paths:
	•	Use the built-in multi-record API in hwcapture.py (the record_multiple helper) by writing a custom endpoint or WS action that calls:

record_multiple(
  devices=["/dev/video0","/dev/video1"],
  outputs=["cam0.mp4","cam1.mp4"],
  duration=your_duration
)


	•	Extend the WS logic to maintain a map of feed → HWAccelRecorder instead of a single _recorder.  Each start_record could register a new recorder under its feed name, and each stop_record would shut down just that feed.

⸻

Bottom line: out-of-the-box you only ever record one feed at once. If you want N feeds live while recording, you’ll need to either call record_multiple(...) or manage N recorder instances yourself.