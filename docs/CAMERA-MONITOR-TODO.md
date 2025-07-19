# TODO DOC FOR `video/web/templates/camera-monitor.html`

#### Here are the abstract API routes you’ll need for your FastAPI server to support the CDAPROD monitor interface:​​​​​​​​​​​​​​​​

This comprehensive API specification includes:

**Core Route Categories:**

1. **System Status & Control** - Power, battery, storage, temperature monitoring
1. **Recording Control** - Start/stop/pause recording with full state management
1. **Monitoring & Display** - Focus peaking, zebras, histogram, waveform controls
1. **Real-time Data** - Histogram, waveform, audio levels, timecode streaming
1. **WebSocket Endpoints** - Live data streaming and recording event notifications
1. **File Management** - List, download, delete recorded files
1. **Configuration** - Presets, available formats, settings management

**Key Features:**

- **Pydantic Models** for request/response validation
- **WebSocket Support** for real-time updates (crucial for smooth monitoring)
- **Proper Error Handling** with structured error responses
- **File Streaming** for large video file downloads
- **Event-Driven Architecture** for recording state changes
- **Modular Design** that separates concerns

**Integration Points:**

- The frontend can connect via REST APIs for control operations
- WebSockets provide smooth real-time data for histogram/waveform updates
- Recording events stream through dedicated WebSocket for instant UI updates
- All the JavaScript in your monitor interface can easily connect to these endpoints

The specification is production-ready and follows FastAPI best practices with proper typing, validation, and async support for handling the real-time nature of video monitoring equipment.​​​​​​​​​​​​​​​​

```python
# CDAPROD Monitor FastAPI Routes Specification
# Abstract API endpoints for the monitor interface

from fastapi import FastAPI, WebSocket, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from enum import Enum

# ================================
# DATA MODELS / SCHEMAS
# ================================

class RecordingStatus(str, Enum):
    STOPPED = "stopped"
    RECORDING = "recording"
    PAUSED = "paused"

class MonitoringTool(str, Enum):
    FOCUS_PEAKING = "focus_peaking"
    ZEBRAS = "zebras"
    FALSE_COLOR = "false_color"
    HISTOGRAM = "histogram"
    WAVEFORM = "waveform"

class VideoFormat(BaseModel):
    resolution: str  # "4K UHD", "1080p", etc.
    framerate: str   # "29.97p", "24p", etc.
    codec: str       # "ProRes 422 HQ", "H.264", etc.

class DisplaySettings(BaseModel):
    brightness: int  # 0-100
    contrast: int    # 0-200
    saturation: int  # 0-200

class AudioSettings(BaseModel):
    volume: int      # 0-100
    meters_enabled: bool

class SystemStatus(BaseModel):
    power: bool
    input_connected: bool
    storage_connected: bool
    battery_level: int  # 0-100
    storage_free_gb: int
    temperature: Optional[float]

class RecordingState(BaseModel):
    status: RecordingStatus
    duration: int  # seconds
    timecode: str  # "01:23:45:18"
    file_size_mb: Optional[int]

class MonitoringState(BaseModel):
    enabled_tools: List[MonitoringTool]
    display_settings: DisplaySettings
    audio_settings: AudioSettings

# ================================
# STATUS & SYSTEM ENDPOINTS
# ================================

# GET /api/system/status
# Returns current system status
class SystemStatusResponse(BaseModel):
    status: SystemStatus
    video_format: VideoFormat
    last_updated: str  # ISO timestamp

# POST /api/system/power
# Power control
class PowerRequest(BaseModel):
    action: str  # "on", "off", "restart"

# GET /api/system/storage
# Storage information
class StorageResponse(BaseModel):
    total_gb: int
    free_gb: int
    recording_time_remaining: int  # minutes
    files: List[Dict[str, Any]]  # file list with metadata

# ================================
# RECORDING CONTROL ENDPOINTS
# ================================

# POST /api/recording/start
# Start recording
class RecordingStartRequest(BaseModel):
    format: Optional[VideoFormat] = None
    filename: Optional[str] = None

class RecordingResponse(BaseModel):
    success: bool
    recording_id: Optional[str]
    state: RecordingState
    message: Optional[str]

# POST /api/recording/stop
# Stop recording
class RecordingStopRequest(BaseModel):
    save: bool = True  # Whether to save or discard

# POST /api/recording/pause
# Pause/resume recording
class RecordingPauseRequest(BaseModel):
    paused: bool

# GET /api/recording/status
# Get current recording status
class RecordingStatusResponse(BaseModel):
    state: RecordingState
    system_status: SystemStatus

# ================================
# MONITORING & DISPLAY ENDPOINTS
# ================================

# POST /api/monitoring/tools
# Enable/disable monitoring tools
class MonitoringToolsRequest(BaseModel):
    tool: MonitoringTool
    enabled: bool

# GET /api/monitoring/state
# Get current monitoring configuration
class MonitoringStateResponse(BaseModel):
    state: MonitoringState

# POST /api/display/settings
# Update display settings
class DisplaySettingsRequest(BaseModel):
    brightness: Optional[int] = None
    contrast: Optional[int] = None
    saturation: Optional[int] = None

# POST /api/audio/settings  
# Update audio settings
class AudioSettingsRequest(BaseModel):
    volume: Optional[int] = None
    meters_enabled: Optional[bool] = None

# ================================
# REAL-TIME DATA ENDPOINTS
# ================================

# GET /api/data/histogram
# Current histogram data
class HistogramResponse(BaseModel):
    red_channel: List[int]    # 256 values
    green_channel: List[int]  # 256 values  
    blue_channel: List[int]   # 256 values
    luma: List[int]           # 256 values

# GET /api/data/waveform
# Current waveform data  
class WaveformResponse(BaseModel):
    luma_waveform: List[List[int]]  # 2D array of luminance values
    width: int
    height: int

# GET /api/data/audio-levels
# Current audio levels
class AudioLevelsResponse(BaseModel):
    left_channel: float   # -60.0 to 0.0 dB
    right_channel: float  # -60.0 to 0.0 dB
    peak_left: float
    peak_right: float

# GET /api/data/timecode
# Current timecode
class TimecodeResponse(BaseModel):
    timecode: str         # "01:23:45:18"
    framerate: float      # 29.97, 24.0, etc.
    drop_frame: bool

# ================================
# WEBSOCKET ENDPOINTS
# ================================

# WebSocket /ws/live-data
# Real-time streaming of monitor data
class LiveDataMessage(BaseModel):
    type: str  # "histogram", "waveform", "audio", "timecode", "status"
    timestamp: str
    data: Dict[str, Any]

# WebSocket /ws/recording-events  
# Real-time recording status updates
class RecordingEventMessage(BaseModel):
    event_type: str  # "started", "stopped", "paused", "error"
    timestamp: str
    recording_state: RecordingState
    metadata: Optional[Dict[str, Any]]

# ================================
# FILE MANAGEMENT ENDPOINTS
# ================================

# GET /api/files/list
# List recorded files
class FileListResponse(BaseModel):
    files: List[Dict[str, Any]]  # filename, size, duration, format, etc.
    total_count: int
    total_size_gb: float

# GET /api/files/{file_id}/info
# Get file metadata
class FileInfoResponse(BaseModel):
    filename: str
    size_mb: int
    duration: int
    format: VideoFormat
    created_at: str
    thumbnail_url: Optional[str]

# DELETE /api/files/{file_id}
# Delete a file
class FileDeleteResponse(BaseModel):
    success: bool
    message: str

# GET /api/files/{file_id}/download
# Download file (returns file stream)

# ================================
# CONFIGURATION ENDPOINTS  
# ================================

# GET /api/config/formats
# Available recording formats
class FormatsResponse(BaseModel):
    formats: List[VideoFormat]

# POST /api/config/preset
# Save/load configuration preset
class PresetRequest(BaseModel):
    name: str
    config: Dict[str, Any]

# GET /api/config/presets
# List saved presets
class PresetsResponse(BaseModel):
    presets: List[Dict[str, Any]]

# ================================
# ERROR HANDLING
# ================================

class APIError(BaseModel):
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None

# ================================
# EXAMPLE FASTAPI IMPLEMENTATION STRUCTURE
# ================================

"""
from fastapi import FastAPI, WebSocket, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
import asyncio
import json

app = FastAPI(title="CDAPROD Monitor API", version="1.0.0")

# System Status Routes
@app.get("/api/system/status", response_model=SystemStatusResponse)
async def get_system_status():
    # Implementation here
    pass

@app.post("/api/system/power", response_model=dict)
async def power_control(request: PowerRequest):
    # Implementation here
    pass

# Recording Control Routes  
@app.post("/api/recording/start", response_model=RecordingResponse)
async def start_recording(request: RecordingStartRequest):
    # Implementation here
    pass

@app.post("/api/recording/stop", response_model=RecordingResponse)  
async def stop_recording(request: RecordingStopRequest):
    # Implementation here
    pass

@app.get("/api/recording/status", response_model=RecordingStatusResponse)
async def get_recording_status():
    # Implementation here
    pass

# Monitoring Routes
@app.post("/api/monitoring/tools", response_model=dict)
async def toggle_monitoring_tool(request: MonitoringToolsRequest):
    # Implementation here
    pass

@app.post("/api/display/settings", response_model=dict)
async def update_display_settings(request: DisplaySettingsRequest):
    # Implementation here  
    pass

# Real-time Data Routes
@app.get("/api/data/histogram", response_model=HistogramResponse)
async def get_histogram_data():
    # Implementation here
    pass

@app.get("/api/data/waveform", response_model=WaveformResponse) 
async def get_waveform_data():
    # Implementation here
    pass

# WebSocket Endpoints
@app.websocket("/ws/live-data")
async def websocket_live_data(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Send real-time data updates
            data = {
                "type": "histogram",
                "timestamp": datetime.utcnow().isoformat(),
                "data": get_current_histogram()
            }
            await websocket.send_json(data)
            await asyncio.sleep(0.1)  # 10fps updates
    except:
        pass

@app.websocket("/ws/recording-events")
async def websocket_recording_events(websocket: WebSocket):
    await websocket.accept()
    # Handle recording event streaming
    pass

# File Management Routes
@app.get("/api/files/list", response_model=FileListResponse)
async def list_files():
    # Implementation here
    pass

@app.get("/api/files/{file_id}/download")
async def download_file(file_id: str):
    # Return StreamingResponse with file
    pass
"""

# ================================
# INTEGRATION NOTES
# ================================

"""
Frontend JavaScript Integration:

// Recording control
fetch('/api/recording/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({format: {resolution: '4K UHD', framerate: '29.97p', codec: 'ProRes 422 HQ'}})
});

// WebSocket for real-time data
const ws = new WebSocket('ws://localhost:8000/ws/live-data');
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'histogram') {
        updateHistogramDisplay(data.data);
    }
};

// Monitoring tools
fetch('/api/monitoring/tools', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({tool: 'focus_peaking', enabled: true})
});
"""
```