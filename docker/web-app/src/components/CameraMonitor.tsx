// docker/web-app/src/components/CameraMonitor.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useVideoSocketCtx } from '@providers/VideoSocketProvider';

// Dynamically load gl-react overlays (no SSR)
const FocusPeakingOverlay = dynamic(
  () => import('./overlays/FocusPeakingOverlay'),
  { ssr: false }
);
const ZebraOverlay = dynamic(
  () => import('./overlays/ZebraOverlay'),
  { ssr: false }
);
const FalseColorOverlay = dynamic(
  () => import('./overlays/FalseColorOverlay'),
  { ssr: false }
);
const HistogramMonitor = dynamic(
  () => import('./overlays/HistogramMonitor'),
  { ssr: false }
);
const WaveformMonitor = dynamic(
  () => import('./overlays/WaveformMonitor'),
  { ssr: false }
);

// --- 1) TYPES & ENUMS ---
type Codec = 'h264' | 'hevc';
type Feed  = 'main' | 'aux';

interface DeviceListEvt {
  event: 'device_list';
  data: Array<{ path: string; width: number; height: number; fps: number }>;
}
interface SelectStreamMsg {
  action:'select_stream';
  feed: Feed;
  device: string;
}
interface SetCodecMsg {
  action: 'set_codec';
  codec: Codec;
}
interface StartRecordMsg {
  action:   'start_record';
  feed:     Feed;
  device:   string;
  filename: string;
  codec:    Codec;
  timecode: string;   // e.g. "01:23:45:18"
}
interface StopRecordMsg {
  action: 'stop_record';
  feed:   Feed;
}
interface ToggleOverlayMsg {
  action:  'toggle_overlay';
  overlay: 'focusPeaking' | 'zebras' | 'falseColor';
  enabled: boolean;
}
interface ListDevicesMsg {
  action: 'list_devices';
}
type OutboundMsg = StartRecordMsg | StopRecordMsg | ToggleOverlayMsg | SelectStreamMsg | SetCodecMsg | ListDevicesMsg;

interface RecordingStatusEvt {
  event: 'recording_status';
  data:  { feed: Feed; elapsed: number; };
}
interface RecordingStartedEvt {
  event: 'recording_started';
  data:  { file: string; };
}
interface RecordingStoppedEvt {
  event: 'recording_stopped';
  data:  {};
}
interface OverlayToggledEvt {
  event: 'overlay_toggled';
  data:  { overlay: 'focusPeaking'|'zebras'|'falseColor'; enabled: boolean; };
}
interface BatteryEvt {
  event: 'battery';
  data:  { level: number };
}
interface HistogramEvt {
  event: 'histogram';
  data:  { buckets: number[] };
}
type InboundMsg =
  | RecordingStatusEvt
  | RecordingStartedEvt
  | RecordingStoppedEvt
  | OverlayToggledEvt
  | BatteryEvt
  | HistogramEvt;


// --- 2) FORMAT HOOKS ---
function useTimecode(initial = {h:0,m:0,s:0,f:0}) {
  const [tc, setTc] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => {
      setTc(prev => {
        let {h,m,s,f} = prev;
        f++;
        if (f >= 30) { f=0; s++; }
        if (s >= 60) { s=0; m++; }
        if (m >= 60) { m=0; h++; }
        return {h,m,s,f};
      });
    }, 33);
    return () => clearInterval(id);
  }, []);
  const format = useCallback(() => {
    const z = (n:number) => n.toString().padStart(2,'0');
    return `${z(tc.h)}:${z(tc.m)}:${z(tc.s)}:${z(tc.f)}`;
  }, [tc]);
  return { tc, format };
}

// Helper function to format recording time
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

const CameraMonitor: React.FC = () => {
  const { sendJSON } = useVideoSocketCtx();
  
  /* State management */
  const [selectedDevice, setSelectedDevice]           = useState<string>('/dev/video0');
  const [selectedCodec, setSelectedCodec]             = useState<Codec>('h264');
  const [devices, setDevices]                         = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo]                   = useState({ width: 0, height: 0, fps: 0 });
  const [devicesAvailableNow, setDevicesAvailableNow] = useState<string[]>([]);
  const [allDevicesSeen, setAllDevicesSeen]           = useState<string[]>(() => {
    // Try to load last seen from localStorage
    const stored = typeof window !== 'undefined' && window.localStorage.getItem('cameraDevices');
    return stored ? JSON.parse(stored) : [];
  });
  const [previewWidth, setPreviewWidth]               = useState(1280);
  const [previewHeight, setPreviewHeight]             = useState(720);
  const [previewFps, setPreviewFps]                   = useState(30);
  // Recording state - using server-driven timing
  const [isRecording, setIsRecording]                 = useState(false);
  const [recordingTime, setRecordingTime]             = useState(0);
  // Timecode
  const { tc: timecode, format: formatTimecode }      = useTimecode({h:1,m:23,s:45,f:18});
  // Overlays
  const [focusPeakingActive, setFocusPeakingActive]   = useState(false);
  const [zebrasActive, setZebrasActive]               = useState(false);
  const [falseColorActive, setFalseColorActive]       = useState(false);
  // Other Indicators
  const [batteryLevel, setBatteryLevel]               = useState(85);
  const [streamOK, setStreamOK]                       = useState(true);
  // Histogram data
  //const [histogramData, setHistogramData]             = useState([20, 45, 65, 80, 70, 55, 40, 25]);
  const [showScopes, setShowScopes]   = useState(true);
  // Slider states
  const [brightness, setBrightness]   = useState(80);
  const [contrast, setContrast]       = useState(100);
  const [saturation, setSaturation]   = useState(100);
  const [volume, setVolume]           = useState(75);

  // Ref to the <img> MJPEG element
  //const imgRef = useRef<HTMLImageElement>(null);
  // imgRef to mediaRef (so it can point to either an <img> or a <video>
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

  useEffect(() => {
    sendJSON({ action: 'list_devices' } as ListDevicesMsg);
  
    const handler = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as InboundMsg | DeviceListEvt;
        if (msg.event === 'device_list') {
          const nowList = msg.data.map(d => d.path);
  
          setDevicesAvailableNow(nowList);
  
          // Merge with all previously seen devices
          setAllDevicesSeen(prev => {
            const merged = Array.from(new Set([...prev, ...nowList]));
            // Persist to localStorage
            window.localStorage.setItem('cameraDevices', JSON.stringify(merged));
            return merged;
          });
  
          // Fallback logic for selectedDevice
          if (!nowList.includes(selectedDevice)) {
            // Try to restore last selection from localStorage
            const lastSelected = window.localStorage.getItem('lastSelectedDevice');
            if (lastSelected && nowList.includes(lastSelected)) {
              setSelectedDevice(lastSelected);
              // Optionally notify backend:
              sendJSON({
                action: 'select_stream',
                feed: 'main',
                device: lastSelected,
              } as SelectStreamMsg);
            } else if (nowList.length > 0) {
              setSelectedDevice(nowList[0]);
              sendJSON({
                action: 'select_stream',
                feed: 'main',
                device: nowList[0],
              } as SelectStreamMsg);
            }
          }
  
          // Set device info if available
          const info = msg.data.find(d => d.path === selectedDevice) || msg.data[0];
          if (info) setDeviceInfo(info);
        }
      } catch {}
    };
  
    window.addEventListener('video-socket-message', handler as any);
    return () => window.removeEventListener('video-socket-message', handler as any);
  }, [sendJSON, selectedDevice]);
  
  // Sync preview settings to the selected device’s capabilities
  useEffect(() => {
    const { width, height, fps } = deviceInfo;
    if (width > 0 && height > 0 && fps > 0) {
      setPreviewWidth(width);
      setPreviewHeight(height);
      // round the incoming fps to the nearest integer
      const roundedFps = Math.round(fps);
      setPreviewFps(roundedFps);
    }
  }, [deviceInfo]);

  const handleRecordToggle = useCallback(() => {
    setIsRecording(prev => {
      const next = !prev;
  
      if (next) {
        // ISO timestamp, safe for filenames after a bit of cleanup
        const now = new Date().toISOString().replace(/[:.]/g,'-');
        const filename = `capture_${now}.mp4`;
        sendJSON({
          action:   'start_record',
          feed:     'main',
          device:   selectedDevice,
          filename,
          codec:    selectedCodec,
          timecode: formatTimecode(),
        } as StartRecordMsg);
      } else {
        sendJSON({ action: 'stop_record', feed: 'main' } as StopRecordMsg);
      }
  
      return next;
    });
  }, [selectedDevice, selectedCodec, formatTimecode, sendJSON]);
  
  // Handler: codec change
  const handleCodecChange = useCallback((newCodec: Codec) => {
    setSelectedCodec(newCodec);
    // Immediately notify backend of codec change
    const msg: SetCodecMsg = {
      action: 'set_codec',
      codec: newCodec,
    };
    sendJSON(msg);
  }, [sendJSON]);

  // Handler: device change
  const handleDeviceChange = useCallback((device: string) => {
    setSelectedDevice(device);
    window.localStorage.setItem('lastSelectedDevice', device);
    const msg: SelectStreamMsg = {
      action: 'select_stream',
      feed: 'main',
      device: device,
    };
    sendJSON(msg);
  }, [sendJSON]);

  /** 3) Typed inbound socket handler */
  useEffect(() => {
    const onSocket = (ev: MessageEvent) => {
      let msg: InboundMsg;
      try { msg = JSON.parse(ev.data); }
      catch { return; }

      switch (msg.event) {
        case 'recording_status':
          // Use server-driven recording time
          setRecordingTime(msg.data.elapsed);
          setIsRecording(true);
          break;

        case 'recording_started':
          setIsRecording(true);
          setRecordingTime(0); // Reset timer on new recording
          break;

        case 'recording_stopped':
          setIsRecording(false);
          break;

        case 'overlay_toggled':
          if (msg.data.overlay === 'focusPeaking') setFocusPeakingActive(msg.data.enabled);
          if (msg.data.overlay === 'zebras')       setZebrasActive(msg.data.enabled);
          if (msg.data.overlay === 'falseColor')   setFalseColorActive(msg.data.enabled);
          break;

        case 'battery':
          setBatteryLevel(msg.data.level);
          break;

      }
    };

    window.addEventListener('video-socket-message', onSocket as any);
    return () => window.removeEventListener('video-socket-message', onSocket as any);
  }, []);

  // Battery drain simulation (remove if backend provides real data)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRecording && Math.random() < 0.1) {
        setBatteryLevel(prev => Math.max(0, prev - 1));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isRecording]);

  // Histogram animation (remove if backend provides real data)
  //useEffect(() => {
    //const interval = setInterval(() => {
      //setHistogramData(prev => prev.map(() => Math.random() * 80 + 10));
    //}, 2000);

    //return () => clearInterval(interval);
  //}, []);
  
  const handleToggleOverlay = useCallback((overlay: 'focusPeaking'|'zebras'|'falseColor') => {
    const enabled = overlay === 'focusPeaking'
      ? !focusPeakingActive
      : overlay === 'zebras'
        ? !zebrasActive
        : !falseColorActive;
    sendJSON({ action: 'toggle_overlay', overlay, enabled } as ToggleOverlayMsg);
  }, [focusPeakingActive, zebrasActive, falseColorActive, sendJSON]);
  
  const handleFullscreenToggle = useCallback(() => {
    const videoElement = document.querySelector('.camera-video-feed') as HTMLElement;
    if (!videoElement) return;
    if (
      !document.fullscreenElement &&
      !(document as any).webkitFullscreenElement &&
      !(document as any).mozFullScreenElement &&
      !(document as any).msFullscreenElement
    ) {
      if (videoElement.requestFullscreen) {
        videoElement.requestFullscreen();
      } else if ((videoElement as any).webkitRequestFullscreen) {
        (videoElement as any).webkitRequestFullscreen();
      } else if ((videoElement as any).mozRequestFullScreen) {
        (videoElement as any).mozRequestFullScreen();
      } else if ((videoElement as any).msRequestFullscreen) {
        (videoElement as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  }, []);

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-gray-900 to-black text-white font-sans overflow-hidden select-none flex flex-col">
      {/* Custom Styles */}
      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0.7; }
        }
        @keyframes recordBlink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.7; }
        }
        @keyframes recordPulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(255, 0, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
        }
        .status-dot-active { animation: blink 1s infinite; }
        .status-dot-recording { animation: pulse 0.5s infinite; }
        .recording-blink { animation: recordBlink 1s infinite; }
        .record-pulse { animation: recordPulse 0.8s infinite; }
      `}</style>

      {/* Top Status Bar */}
      <div className="h-11 bg-gradient-to-b from-gray-700 to-gray-800 flex justify-between items-center px-4 border-b border-gray-600">
        <div className="text-orange-500 font-bold text-base tracking-wider">CDAPROD</div>
        <div className="flex gap-5 items-center">
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <div className={`w-1.5 h-1.5 rounded-full bg-green-500 status-dot-active`}></div>
            <span>PWR</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-red-500 status-dot-recording' : 'bg-gray-600'}`}></div>
            <span>REC</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 status-dot-active"></div>
            <span>INPUT</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <div className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-green-500 status-dot-active' : 'bg-gray-600'}`}></div>
            <span>SSD</span>
          </div>
        </div>
      </div>
          
      {/* Main Content Area */}
      <div className="flex flex-1">
        <div className="flex-1 bg-black relative m-2 border-2 border-gray-700 rounded flex items-center justify-center overflow-hidden">

          {/* 1) The preview wrapper */}
          <div className="relative w-full h-full">
            {streamOK ? (
              // Live MJPEG
              <img
                ref={mediaRef as React.RefObject<HTMLImageElement>}
                src={`/api/v1/hwcapture/stream?device=${encodeURIComponent(
                  selectedDevice
                )}&width=${previewWidth}&height=${previewHeight}&fps=${previewFps}`}
                className="camera-video-feed w-full h-full object-contain absolute top-0 left-0 z-0"
                onError={() => setStreamOK(false)}
                onLoad={() => setStreamOK(true)}
              />
            ) : (
              // Animated-GIF fallback
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src="https://media1.tenor.com/m/1VZnQCgDgFkAAAAC/no-cameras-clinton-sparks.gif"
                autoPlay
                loop
                muted
                className="camera-video-feed w-full h-full object-cover absolute top-0 left-0 z-0"
                onLoadedData={() => setStreamOK(true)}
              />
            )}

            {/* Fullscreen toggle (only when live) */}
            {streamOK && (
              <button
                className="absolute bottom-4 right-4 bg-black/70 text-white text-xs px-3 py-1 rounded hover:bg-black/90 transition-opacity duration-200 opacity-70 hover:opacity-100 z-10"
                onClick={handleFullscreenToggle}
              >
                ⛶ Fullscreen
              </button>
            )}

            {/* GPU-accelerated overlays */}
            <FocusPeakingOverlay
              texture={mediaRef.current}
              resolution={[previewWidth, previewHeight]}
              enabled={focusPeakingActive}
            />
            <ZebraOverlay
              texture={mediaRef.current}
              enabled={zebrasActive}
            />
            <FalseColorOverlay
              texture={mediaRef.current}
              enabled={falseColorActive}
            />
          </div>


          { /* Recording indicator */ }
          {isRecording && (
            <div className="absolute top-4 right-4 bg-red-600/90 text-white px-4 py-2 rounded-full font-bold text-xs recording-blink">
              ● REC {formatTime(recordingTime)}
            </div>
          )}

          { /* Input info badge */ }
          <div className="absolute top-4 left-4 bg-black/80 p-2.5 rounded text-xs leading-relaxed">
            <div>{deviceInfo.width}×{deviceInfo.height}</div>
            <div>{deviceInfo.fps.toFixed(2)} fps</div>
            <div>{selectedDevice.replace('/dev/', '')}</div>
          </div>

          { /* Timecode display */ }
          <div className="absolute bottom-4 left-4 bg-black/90 px-3 py-2 rounded font-mono text-base text-green-500 font-bold">
            {formatTimecode()}
          </div>
        </div> 

        {/* Control Panel */}
        <div className="w-45 bg-gradient-to-b from-gray-700 to-gray-900 border-l border-gray-700 p-3 overflow-y-auto">

          {/* ◆ Device & Codec Selectors ◆ */}
          <div className="mb-4 bg-black/20 border border-gray-600 rounded-md p-2.5">
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">
              Source & Codec
            </div>

            {/* Device dropdown */}
            <label className="text-xs text-gray-300">Input:</label>
            <select
              value={selectedDevice}
              onChange={e => handleDeviceChange(e.target.value)}
              className="w-full mb-2 p-1 bg-gray-800 text-white text-sm rounded"
            >
              {allDevicesSeen.map(dev => (
                <option
                  key={dev}
                  value={dev}
                  disabled={!devicesAvailableNow.includes(dev)}
                  style={{
                    color: devicesAvailableNow.includes(dev) ? '#fff' : '#888',
                    background: devicesAvailableNow.includes(dev) ? '' : '#333',
                  }}
                >
                  {dev}{!devicesAvailableNow.includes(dev) ? ' (offline)' : ''}
                </option>
              ))}
            </select>

            {/* Codec dropdown */}
            <label className="text-xs text-gray-300">Codec:</label>
            <select
              value={selectedCodec}
              onChange={e => handleCodecChange(e.target.value as Codec)}
              className="w-full p-1 bg-gray-800 text-white text-sm rounded"
            >
              <option value="h264">H.264</option>
              <option value="hevc">HEVC</option>
            </select>
          </div>
          
          {/* Recording Controls */}
          <div className="mb-4 bg-black/30 border border-gray-600 rounded-md p-2.5">
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">Record</div>
            <button 
              onClick={handleRecordToggle}
              className={`w-full p-2 mb-1 bg-gradient-to-br border rounded text-white text-xs cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                isRecording 
                  ? 'from-red-600 to-red-800 border-red-600 record-pulse' 
                  : 'from-gray-600 to-gray-700 border-gray-500 hover:from-gray-500 hover:to-gray-600'
              }`}
            >
              {isRecording ? '⏸ STOP REC' : '● RECORD'}
            </button>
            <button className="w-full p-2 mb-1 bg-gradient-to-br from-gray-600 to-gray-700 border border-gray-500 rounded text-white text-xs cursor-pointer transition-all duration-200 hover:from-gray-500 hover:to-gray-600 hover:-translate-y-0.5">
              ▶ PLAY
            </button>
            <button className="w-full p-2 mb-1 bg-gradient-to-br from-gray-600 to-gray-700 border border-gray-500 rounded text-white text-xs cursor-pointer transition-all duration-200 hover:from-gray-500 hover:to-gray-600 hover:-translate-y-0.5">
              ⏹ STOP
            </button>
          </div>
          
          {/* Monitoring Tools */}
          <div className="mb-4 bg-black/30 border border-gray-600 rounded-md p-2.5">
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">
              Monitor
            </div>

            {(['focusPeaking','zebras','falseColor'] as const).map(o => {
              const active =
                o === 'focusPeaking' ? focusPeakingActive :
                o === 'zebras'       ? zebrasActive :
                                       falseColorActive;
              const label =
                o === 'focusPeaking' ? 'Focus Peaking' :
                o === 'zebras'       ? 'Zebras' :
                                       'False Color';

              return (
                <button
                  key={o}
                  className={`
                    w-full p-2 mb-1 bg-gradient-to-br border rounded text-white text-xs
                    cursor-pointer transition-all duration-200 hover:-translate-y-0.5 
                    ${
                      active
                        ? 'from-orange-600 to-orange-800 border-orange-600 shadow-lg shadow-orange-500/30'
                        : 'from-gray-600 to-gray-700 border-gray-500 hover:from-gray-500 hover:to-gray-600'
                    }
                  `}
                  onClick={() => handleToggleOverlay(o)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          
          
          {/* Display Settings */}
          <div className="mb-4 bg-black/30 border border-gray-600 rounded-md p-2.5">
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">Display</div>
            
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-300 mb-1">
                <span>Brightness</span>
                <span>{brightness}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded outline-none slider-thumb"
                style={{
                  background: `linear-gradient(to right, #ff4500 0%, #ff4500 ${brightness}%, #666 ${brightness}%, #666 100%)`
                }}
              />
            </div>
            
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-300 mb-1">
                <span>Contrast</span>
                <span>{contrast}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded outline-none"
                style={{
                  background: `linear-gradient(to right, #ff4500 0%, #ff4500 ${contrast/2}%, #666 ${contrast/2}%, #666 100%)`
                }}
              />
            </div>
            
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-300 mb-1">
                <span>Saturation</span>
                <span>{saturation}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="200" 
                value={saturation}
                onChange={(e) => setSaturation(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded outline-none"
                style={{
                  background: `linear-gradient(to right, #ff4500 0%, #ff4500 ${saturation/2}%, #666 ${saturation/2}%, #666 100%)`
                }}
              />
            </div>
          </div>

          {/* Audio Monitoring */}
          <div className="mb-4 bg-black/30 border border-gray-600 rounded-md p-2.5">
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">Audio</div>
            <button className="w-full p-2 mb-1 bg-gradient-to-br from-orange-600 to-orange-800 border border-orange-600 shadow-lg shadow-orange-500/30 rounded text-white text-xs cursor-pointer transition-all duration-200 hover:-translate-y-0.5">
              Audio Meters
            </button>
            
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-300 mb-1">
                <span>Volume</span>
                <span>{volume}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded outline-none"
                style={{
                  background: `linear-gradient(to right, #ff4500 0%, #ff4500 ${volume}%, #666 ${volume}%, #666 100%)`
                }}
              />
            </div>
          </div>

          {/* Waveform Monitor */}
          <div className="mb-4 bg-black/30 border border-gray-600 rounded-md p-2.5">
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">
              Waveform
            </div>
            <WaveformMonitor
              source={mediaRef.current}
              width={200}
              height={60}
              enabled={showScopes}
            />
          </div>

          {/* Histogram */}
          <div className="mb-4 bg-black/30 border border-gray-600 rounded-md p-2.5">
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">
              Histogram
            </div>
            <HistogramMonitor
              source={mediaRef.current}
              width={200}
              height={40}
              enabled={showScopes}
            />
          </div>
          
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="h-10 bg-gradient-to-b from-gray-800 to-gray-900 border-t border-gray-700 flex items-center justify-between px-4">
        <div className="text-xs text-gray-300 flex gap-4">
          <span>ProRes 422 HQ</span>
          <span>4K UHD 29.97p</span>
          <span>Storage: 847GB Free</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <div className="w-6 h-3 border border-gray-300 rounded-sm relative">
            <div 
              className={`h-full rounded-sm transition-all duration-300 ${batteryLevel < 20 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${batteryLevel}%` }}
            ></div>
            <div className="w-0.5 h-1.5 bg-gray-300 absolute -right-0.5 top-0.5 rounded-r-sm"></div>
          </div>
          <span className="text-gray-300">{batteryLevel}%</span>
        </div>
      </div>
    </div>
  );
};

export default CameraMonitor;