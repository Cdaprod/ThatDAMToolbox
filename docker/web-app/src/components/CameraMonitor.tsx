import React, { useState, useEffect, useRef } from 'react';

const CameraMonitor: React.FC = () => {
  // State management
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [timecode, setTimecode] = useState({ hours: 1, minutes: 23, seconds: 45, frames: 18 });
  const [focusPeakingActive, setFocusPeakingActive] = useState(false);
  const [zebrasActive, setZebrasActive] = useState(false);
  const [falseColorActive, setFalseColorActive] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [imageError, setImageError] = useState(true);
  
  // Slider states
  const [brightness, setBrightness] = useState(80);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [volume, setVolume] = useState(75);
  
  // Histogram data
  const [histogramData, setHistogramData] = useState([20, 45, 65, 80, 70, 55, 40, 25]);

  // Update timecode
  useEffect(() => {
    const interval = setInterval(() => {
      setTimecode(prev => {
        let { hours, minutes, seconds, frames } = prev;
        frames++;
        if (frames >= 30) {
          frames = 0;
          seconds++;
          if (seconds >= 60) {
            seconds = 0;
            minutes++;
            if (minutes >= 60) {
              minutes = 0;
              hours++;
            }
          }
        }
        return { hours, minutes, seconds, frames };
      });
    }, 33);

    return () => clearInterval(interval);
  }, []);

  // Update recording time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Battery drain simulation
  useEffect(() => {
    const interval = setInterval(() => {
      if (isRecording && Math.random() < 0.1) {
        setBatteryLevel(prev => Math.max(0, prev - 1));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isRecording]);

  // Histogram animation
  useEffect(() => {
    const interval = setInterval(() => {
      setHistogramData(prev => prev.map(() => Math.random() * 80 + 10));
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60).toString().padStart(2, '0');
    const secs = (time % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const formatTimecode = () => {
    const { hours, minutes, seconds, frames } = timecode;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

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
        @keyframes waveMove {
          0% { left: -2px; }
          100% { left: 100%; }
        }
        .status-dot-active { animation: blink 1s infinite; }
        .status-dot-recording { animation: pulse 0.5s infinite; }
        .recording-blink { animation: recordBlink 1s infinite; }
        .record-pulse { animation: recordPulse 0.8s infinite; }
        .wave-line { animation: waveMove 2s linear infinite; }
        .focus-peaking-overlay {
          background: 
            radial-gradient(circle at 30% 40%, rgba(255, 0, 0, 0.3) 2px, transparent 2px),
            radial-gradient(circle at 70% 30%, rgba(255, 0, 0, 0.3) 1px, transparent 1px),
            radial-gradient(circle at 20% 70%, rgba(255, 0, 0, 0.3) 1px, transparent 1px);
          background-size: 40px 40px, 60px 60px, 80px 80px;
        }
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
          {/* Video Placeholder */}
          {imageError && (
            <div className="text-gray-600 text-3xl text-center opacity-60">📹 NO SIGNAL</div>
          )}
          
          {/* Mock Live Preview */}
          <img 
            src="/api/v1/hwcapture/stream?device=/dev/video0&width=1280&height=720&fps=30"
            alt="Live Preview"
            className="w-full h-full object-contain absolute top-0 left-0 z-0"
            style={{ display: imageError ? 'none' : 'block' }}
            onError={() => setImageError(true)}
            onLoad={() => setImageError(false)}
          />

          {/* Video Overlays */}
          {isRecording && (
            <div className="absolute top-4 right-4 bg-red-600/90 text-white px-4 py-2 rounded-full font-bold text-xs recording-blink">
              ● REC {formatTime(recordingTime)}
            </div>
          )}

          <div className="absolute top-4 left-4 bg-black/80 p-2.5 rounded text-xs leading-relaxed">
            <div>4K UHD 3840×2160</div>
            <div>29.97p ProRes 422 HQ</div>
            <div>HDMI Input</div>
          </div>

          <div className="absolute bottom-4 left-4 bg-black/90 px-3 py-2 rounded font-mono text-base text-green-500 font-bold">
            {formatTimecode()}
          </div>

          {focusPeakingActive && (
            <div className="absolute inset-0 opacity-100 transition-opacity duration-300 focus-peaking-overlay pointer-events-none"></div>
          )}
        </div>

        {/* Control Panel */}
        <div className="w-45 bg-gradient-to-b from-gray-700 to-gray-900 border-l border-gray-700 p-3 overflow-y-auto">
          {/* Recording Controls */}
          <div className="mb-4 bg-black/30 border border-gray-600 rounded-md p-2.5">
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">Record</div>
            <button 
              className={`w-full p-2 mb-1 bg-gradient-to-br from-red-600 to-red-800 border border-red-600 rounded text-white text-xs cursor-pointer transition-all duration-200 hover:from-red-500 hover:to-red-700 hover:-translate-y-0.5 font-bold ${isRecording ? 'record-pulse' : ''}`}
              onClick={() => setIsRecording(!isRecording)}
            >
              {isRecording ? '⏸ PAUSE' : '● RECORD'}
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
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">Monitor</div>
            <button 
              className={`w-full p-2 mb-1 bg-gradient-to-br border rounded text-white text-xs cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${focusPeakingActive ? 'from-orange-600 to-orange-800 border-orange-600 shadow-lg shadow-orange-500/30' : 'from-gray-600 to-gray-700 border-gray-500 hover:from-gray-500 hover:to-gray-600'}`}
              onClick={() => setFocusPeakingActive(!focusPeakingActive)}
            >
              Focus Peaking
            </button>
            <button 
              className={`w-full p-2 mb-1 bg-gradient-to-br border rounded text-white text-xs cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${zebrasActive ? 'from-orange-600 to-orange-800 border-orange-600 shadow-lg shadow-orange-500/30' : 'from-gray-600 to-gray-700 border-gray-500 hover:from-gray-500 hover:to-gray-600'}`}
              onClick={() => setZebrasActive(!zebrasActive)}
            >
              Zebras
            </button>
            <button 
              className={`w-full p-2 mb-1 bg-gradient-to-br border rounded text-white text-xs cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${falseColorActive ? 'from-orange-600 to-orange-800 border-orange-600 shadow-lg shadow-orange-500/30' : 'from-gray-600 to-gray-700 border-gray-500 hover:from-gray-500 hover:to-gray-600'}`}
              onClick={() => setFalseColorActive(!falseColorActive)}
            >
              False Color
            </button>
            <button className="w-full p-2 mb-1 bg-gradient-to-br from-orange-600 to-orange-800 border border-orange-600 shadow-lg shadow-orange-500/30 rounded text-white text-xs cursor-pointer transition-all duration-200 hover:-translate-y-0.5">
              Histogram
            </button>
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
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">Waveform</div>
            <div className="w-full h-15 bg-black border border-gray-700 rounded relative overflow-hidden">
              {[30, 45, 60, 35, 50].map((height, index) => (
                <div 
                  key={index}
                  className="absolute bottom-0 w-0.5 bg-green-500 wave-line"
                  style={{ 
                    height: `${height}%`,
                    animationDelay: `${index * 0.2}s`
                  }}
                ></div>
              ))}
            </div>
          </div>

          {/* Histogram */}
          <div className="mb-4 bg-black/30 border border-gray-600 rounded-md p-2.5">
            <div className="text-orange-500 text-xs font-bold uppercase mb-2 tracking-wide">Histogram</div>
            <div className="w-full h-10 bg-black border border-gray-700 rounded flex items-end p-0.5">
              {histogramData.map((height, index) => (
                <div 
                  key={index}
                  className="flex-1 bg-gradient-to-t from-red-500 via-yellow-500 to-green-500 mx-px opacity-70 rounded-t-sm transition-all duration-500"
                  style={{ height: `${height}%` }}
                ></div>
              ))}
            </div>
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