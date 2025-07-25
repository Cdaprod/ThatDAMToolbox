// src/adapters/types.ts
export type Codec = 'h264' | 'hevc' | 'raw';
export type PixelFormat = 'YUYV' | 'NV12' | 'MJPEG' | 'RGB24';

export interface CaptureConfig {
  device: string;
  width: number;
  height: number;
  fps: number;
  codec: Codec;
  pixelFormat?: PixelFormat;
  bitrate?: number;
  hwAccel?: 'vaapi' | 'nvenc' | 'qsv' | 'none';
}

export interface FrameData {
  data: Buffer;
  timestamp: number;
  format: PixelFormat;
  width: number;
  height: number;
  isKeyframe?: boolean;
}

export interface VideoCaptureAdapter {
  startCapture(config: CaptureConfig): Promise<void>;
  stopCapture(): Promise<void>;
  setCodec(codec: Codec): Promise<void>;
  setResolution(width: number, height: number): Promise<void>;
  onFrame(callback: (frameData: FrameData) => void): void;
  onError(callback: (error: Error) => void): void;
  isCapturing(): boolean;
  getCapabilities(): Promise<DeviceCapabilities>;
}

export interface DeviceCapabilities {
  device: string;
  supportedFormats: PixelFormat[];
  supportedResolutions: Array<{ width: number; height: number }>;
  supportedFramerates: number[];
  hasHardwareAcceleration: boolean;
}

// src/adapters/V4L2Adapter.ts
import { spawn, ChildProcess } from 'child_process';
import { VideoCaptureAdapter, CaptureConfig, FrameData, DeviceCapabilities, PixelFormat } from './types';

export class V4L2Adapter implements VideoCaptureAdapter {
  private capturing = false;
  private frameCallback?: (frameData: FrameData) => void;
  private errorCallback?: (error: Error) => void;
  private currentConfig?: CaptureConfig;
  private captureProcess?: ChildProcess;

  async startCapture(config: CaptureConfig): Promise<void> {
    if (this.capturing) {
      throw new Error('Capture already in progress');
    }

    this.currentConfig = config;
    
    try {
      // Use v4l2-ctl to configure the device
      await this.configureDevice(config);
      
      // Start raw frame capture using dd or cat
      await this.startRawCapture(config);
      
      this.capturing = true;
    } catch (error) {
      this.handleError(new Error(`V4L2 capture failed: ${error}`));
    }
  }

  async stopCapture(): Promise<void> {
    if (!this.capturing) return;

    if (this.captureProcess) {
      this.captureProcess.kill('SIGTERM');
      this.captureProcess = undefined;
    }

    this.capturing = false;
  }

  async setCodec(codec: Codec): Promise<void> {
    if (codec !== 'raw') {
      throw new Error('V4L2Adapter only supports raw codec');
    }
    
    if (this.currentConfig) {
      this.currentConfig.codec = codec;
    }
  }

  async setResolution(width: number, height: number): Promise<void> {
    if (this.currentConfig) {
      this.currentConfig.width = width;
      this.currentConfig.height = height;
      
      if (this.capturing) {
        await this.stopCapture();
        await this.startCapture(this.currentConfig);
      }
    }
  }

  onFrame(callback: (frameData: FrameData) => void): void {
    this.frameCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    return new Promise((resolve, reject) => {
      const v4l2Process = spawn('v4l2-ctl', [
        '--device', this.currentConfig?.device || '/dev/video0',
        '--list-formats-ext'
      ]);

      let output = '';
      
      v4l2Process.stdout.on('data', (data) => {
        output += data.toString();
      });

      v4l2Process.on('close', (code) => {
        if (code === 0) {
          resolve(this.parseV4L2Capabilities(output));
        } else {
          reject(new Error(`v4l2-ctl failed with code ${code}`));
        }
      });
    });
  }

  private async configureDevice(config: CaptureConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '--device', config.device,
        '--set-fmt-video',
        `width=${config.width},height=${config.height},pixelformat=${config.pixelFormat || 'YUYV'}`,
        '--set-parm', `${config.fps}`
      ];

      const configProcess = spawn('v4l2-ctl', args);
      
      configProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Device configuration failed with code ${code}`));
        }
      });
    });
  }

  private async startRawCapture(config: CaptureConfig): Promise<void> {
    // Calculate frame size based on pixel format
    const frameSize = this.calculateFrameSize(config.width, config.height, config.pixelFormat || 'YUYV');
    
    this.captureProcess = spawn('dd', [
      `if=${config.device}`,
      `bs=${frameSize}`,
      'count=0'
    ]);

    let buffer = Buffer.alloc(0);

    this.captureProcess.stdout?.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      
      // Process complete frames
      while (buffer.length >= frameSize) {
        const frameData = buffer.slice(0, frameSize);
        buffer = buffer.slice(frameSize);
        
        if (this.frameCallback) {
          this.frameCallback({
            data: frameData,
            timestamp: Date.now(),
            format: config.pixelFormat || 'YUYV',
            width: config.width,
            height: config.height
          });
        }
      }
    });

    this.captureProcess.on('error', (error) => {
      this.handleError(error);
    });
  }

  private calculateFrameSize(width: number, height: number, format: PixelFormat): number {
    switch (format) {
      case 'YUYV': return width * height * 2;
      case 'NV12': return width * height * 1.5;
      case 'RGB24': return width * height * 3;
      case 'MJPEG': return width * height; // Variable, this is approximate
      default: return width * height * 2;
    }
  }

  private parseV4L2Capabilities(output: string): DeviceCapabilities {
    // Parse v4l2-ctl output to extract capabilities
    const formats: PixelFormat[] = [];
    const resolutions: Array<{ width: number; height: number }> = [];
    const framerates: number[] = [];

    // Simple parsing - you'd want more robust parsing in production
    if (output.includes('YUYV')) formats.push('YUYV');
    if (output.includes('MJPG')) formats.push('MJPEG');
    if (output.includes('NV12')) formats.push('NV12');

    // Extract common resolutions
    const resMatches = output.match(/(\d+)x(\d+)/g);
    if (resMatches) {
      resMatches.forEach(match => {
        const [width, height] = match.split('x').map(Number);
        if (!resolutions.find(r => r.width === width && r.height === height)) {
          resolutions.push({ width, height });
        }
      });
    }

    return {
      device: this.currentConfig?.device || '/dev/video0',
      supportedFormats: formats,
      supportedResolutions: resolutions,
      supportedFramerates: [15, 30, 60], // Default values
      hasHardwareAcceleration: false
    };
  }

  private handleError(error: Error): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }
}

// src/adapters/FFmpegAdapter.ts
import { spawn, ChildProcess } from 'child_process';
import { VideoCaptureAdapter, CaptureConfig, FrameData, DeviceCapabilities } from './types';

export class FFmpegAdapter implements VideoCaptureAdapter {
  private capturing = false;
  private frameCallback?: (frameData: FrameData) => void;
  private errorCallback?: (error: Error) => void;
  private currentConfig?: CaptureConfig;
  private ffmpegProcess?: ChildProcess;

  async startCapture(config: CaptureConfig): Promise<void> {
    if (this.capturing) {
      throw new Error('Capture already in progress');
    }

    this.currentConfig = config;
    
    try {
      await this.startFFmpegCapture(config);
      this.capturing = true;
    } catch (error) {
      this.handleError(new Error(`FFmpeg capture failed: ${error}`));
    }
  }

  async stopCapture(): Promise<void> {
    if (!this.capturing) return;

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = undefined;
    }

    this.capturing = false;
  }

  async setCodec(codec: Codec): Promise<void> {
    if (this.currentConfig) {
      this.currentConfig.codec = codec;
      
      if (this.capturing) {
        await this.stopCapture();
        await this.startCapture(this.currentConfig);
      }
    }
  }

  async setResolution(width: number, height: number): Promise<void> {
    if (this.currentConfig) {
      this.currentConfig.width = width;
      this.currentConfig.height = height;
      
      if (this.capturing) {
        await this.stopCapture();
        await this.startCapture(this.currentConfig);
      }
    }
  }

  onFrame(callback: (frameData: FrameData) => void): void {
    this.frameCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    return new Promise((resolve, reject) => {
      const ffprobeProcess = spawn('ffprobe', [
        '-f', 'v4l2',
        '-list_formats', 'all',
        '-i', this.currentConfig?.device || '/dev/video0'
      ]);

      let output = '';
      let errorOutput = '';
      
      ffprobeProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobeProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffprobeProcess.on('close', (code) => {
        // FFprobe might return non-zero but still provide useful info
        resolve(this.parseFFmpegCapabilities(output + errorOutput));
      });
    });
  }

  private async startFFmpegCapture(config: CaptureConfig): Promise<void> {
    const args = this.buildFFmpegArgs(config);
    
    this.ffmpegProcess = spawn('ffmpeg', args);

    let nalBuffer = Buffer.alloc(0);

    this.ffmpegProcess.stdout?.on('data', (data: Buffer) => {
      if (config.codec === 'raw') {
        // Handle raw frames
        if (this.frameCallback) {
          this.frameCallback({
            data,
            timestamp: Date.now(),
            format: config.pixelFormat || 'YUYV',
            width: config.width,
            height: config.height
          });
        }
      } else {
        // Handle encoded frames (H.264/HEVC)
        nalBuffer = Buffer.concat([nalBuffer, data]);
        
        // Extract complete NAL units
        const frames = this.extractNALUnits(nalBuffer);
        frames.forEach(frame => {
          if (this.frameCallback) {
            this.frameCallback({
              data: frame.data,
              timestamp: Date.now(),
              format: 'RGB24', // Encoded format
              width: config.width,
              height: config.height,
              isKeyframe: frame.isKeyframe
            });
          }
        });
      }
    });

    this.ffmpegProcess.stderr?.on('data', (data) => {
      // Log FFmpeg status info
      console.log('FFmpeg:', data.toString());
    });

    this.ffmpegProcess.on('error', (error) => {
      this.handleError(error);
    });

    this.ffmpegProcess.on('close', (code) => {
      if (code !== 0 && this.capturing) {
        this.handleError(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  }

  private buildFFmpegArgs(config: CaptureConfig): string[] {
    const args = [
      '-f', 'v4l2',
      '-framerate', config.fps.toString(),
      '-video_size', `${config.width}x${config.height}`,
      '-i', config.device
    ];

    // Add hardware acceleration if specified
    if (config.hwAccel && config.hwAccel !== 'none') {
      switch (config.hwAccel) {
        case 'vaapi':
          args.push('-vaapi_device', '/dev/dri/renderD128');
          break;
        case 'nvenc':
          args.push('-hwaccel', 'cuda');
          break;
        case 'qsv':
          args.push('-hwaccel', 'qsv');
          break;
      }
    }

    // Configure codec and output
    switch (config.codec) {
      case 'h264':
        if (config.hwAccel === 'vaapi') {
          args.push('-c:v', 'h264_vaapi');
        } else if (config.hwAccel === 'nvenc') {
          args.push('-c:v', 'h264_nvenc');
        } else if (config.hwAccel === 'qsv') {
          args.push('-c:v', 'h264_qsv');
        } else {
          args.push('-c:v', 'libx264');
        }
        break;
      case 'hevc':
        if (config.hwAccel === 'vaapi') {
          args.push('-c:v', 'hevc_vaapi');
        } else if (config.hwAccel === 'nvenc') {
          args.push('-c:v', 'hevc_nvenc');
        } else if (config.hwAccel === 'qsv') {
          args.push('-c:v', 'hevc_qsv');
        } else {
          args.push('-c:v', 'libx265');
        }
        break;
      case 'raw':
        args.push('-c:v', 'rawvideo');
        break;
    }

    // Add bitrate if specified
    if (config.bitrate) {
      args.push('-b:v', `${config.bitrate}k`);
    }

    // Output to stdout
    args.push('-f', config.codec === 'raw' ? 'rawvideo' : 'mpegts', 'pipe:1');

    return args;
  }

  private extractNALUnits(buffer: Buffer): Array<{ data: Buffer; isKeyframe: boolean }> {
    const units: Array<{ data: Buffer; isKeyframe: boolean }> = [];
    let start = 0;

    // Look for NAL unit start codes (0x00 0x00 0x00 0x01)
    for (let i = 0; i < buffer.length - 4; i++) {
      if (buffer[i] === 0x00 && buffer[i + 1] === 0x00 && 
          buffer[i + 2] === 0x00 && buffer[i + 3] === 0x01) {
        
        if (start > 0) {
          const nalData = buffer.slice(start, i);
          const isKeyframe = this.isKeyFrame(nalData);
          units.push({ data: nalData, isKeyframe });
        }
        start = i;
      }
    }

    return units;
  }

  private isKeyFrame(nalUnit: Buffer): boolean {
    if (nalUnit.length < 5) return false;
    
    // Check NAL unit type (H.264)
    const nalType = nalUnit[4] & 0x1F;
    return nalType === 5; // IDR frame
  }

  private parseFFmpegCapabilities(output: string): DeviceCapabilities {
    const formats: any[] = [];
    const resolutions: Array<{ width: number; height: number }> = [];
    
    // Parse FFmpeg/FFprobe output
    if (output.includes('yuyv422')) formats.push('YUYV');
    if (output.includes('mjpeg')) formats.push('MJPEG');
    if (output.includes('nv12')) formats.push('NV12');

    // Extract resolutions from output
    const resMatches = output.match(/(\d+)x(\d+)/g);
    if (resMatches) {
      resMatches.forEach(match => {
        const [width, height] = match.split('x').map(Number);
        if (!resolutions.find(r => r.width === width && r.height === height)) {
          resolutions.push({ width, height });
        }
      });
    }

    return {
      device: this.currentConfig?.device || '/dev/video0',
      supportedFormats: formats,
      supportedResolutions: resolutions,
      supportedFramerates: [15, 30, 60],
      hasHardwareAcceleration: output.includes('vaapi') || output.includes('nvenc')
    };
  }

  private handleError(error: Error): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }
}

// src/adapters/GStreamerAdapter.ts
import { spawn, ChildProcess } from 'child_process';
import { VideoCaptureAdapter, CaptureConfig, FrameData, DeviceCapabilities } from './types';

export class GStreamerAdapter implements VideoCaptureAdapter {
  private capturing = false;
  private frameCallback?: (frameData: FrameData) => void;
  private errorCallback?: (error: Error) => void;
  private currentConfig?: CaptureConfig;
  private gstProcess?: ChildProcess;

  async startCapture(config: CaptureConfig): Promise<void> {
    if (this.capturing) {
      throw new Error('Capture already in progress');
    }

    this.currentConfig = config;
    
    try {
      await this.startGStreamerPipeline(config);
      this.capturing = true;
    } catch (error) {
      this.handleError(new Error(`GStreamer capture failed: ${error}`));
    }
  }

  async stopCapture(): Promise<void> {
    if (!this.capturing) return;

    if (this.gstProcess) {
      this.gstProcess.kill('SIGTERM');
      this.gstProcess = undefined;
    }

    this.capturing = false;
  }

  async setCodec(codec: Codec): Promise<void> {
    if (this.currentConfig) {
      this.currentConfig.codec = codec;
      
      if (this.capturing) {
        await this.stopCapture();
        await this.startCapture(this.currentConfig);
      }
    }
  }

  async setResolution(width: number, height: number): Promise<void> {
    if (this.currentConfig) {
      this.currentConfig.width = width;
      this.currentConfig.height = height;
      
      if (this.capturing) {
        await this.stopCapture();
        await this.startCapture(this.currentConfig);
      }
    }
  }

  onFrame(callback: (frameData: FrameData) => void): void {
    this.frameCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    return new Promise((resolve, reject) => {
      const gstProcess = spawn('gst-device-monitor-1.0', ['Video/Source']);

      let output = '';
      
      gstProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      gstProcess.on('close', (code) => {
        if (code === 0) {
          resolve(this.parseGStreamerCapabilities(output));
        } else {
          reject(new Error(`gst-device-monitor failed with code ${code}`));
        }
      });
    });
  }

  private async startGStreamerPipeline(config: CaptureConfig): Promise<void> {
    const pipeline = this.buildGStreamerPipeline(config);
    
    this.gstProcess = spawn('gst-launch-1.0', pipeline.split(' '));

    this.gstProcess.stdout?.on('data', (data: Buffer) => {
      if (this.frameCallback) {
        this.frameCallback({
          data,
          timestamp: Date.now(),
          format: config.pixelFormat || 'YUYV',
          width: config.width,
          height: config.height
        });
      }
    });

    this.gstProcess.stderr?.on('data', (data) => {
      // Log GStreamer messages
      const message = data.toString();
      if (message.includes('ERROR') || message.includes('WARNING')) {
        console.log('GStreamer:', message);
      }
    });

    this.gstProcess.on('error', (error) => {
      this.handleError(error);
    });

    this.gstProcess.on('close', (code) => {
      if (code !== 0 && this.capturing) {
        this.handleError(new Error(`GStreamer pipeline exited with code ${code}`));
      }
    });
  }

  private buildGStreamerPipeline(config: CaptureConfig): string {
    let pipeline = `v4l2src device=${config.device}`;
    
    // Add caps filter for format/resolution
    pipeline += ` ! video/x-raw,format=${config.pixelFormat || 'YUY2'},width=${config.width},height=${config.height},framerate=${config.fps}/1`;
    
    // Add conversion if needed
    pipeline += ' ! videoconvert';
    
    // Add encoder based on codec and hardware acceleration
    switch (config.codec) {
      case 'h264':
        if (config.hwAccel === 'vaapi') {
          pipeline += ' ! vaapih264enc';
        } else if (config.hwAccel === 'nvenc') {
          pipeline += ' ! nvh264enc';
        } else {
          pipeline += ' ! x264enc tune=zerolatency';
        }
        break;
      case 'hevc':
        if (config.hwAccel === 'vaapi') {
          pipeline += ' ! vaapih265enc';
        } else if (config.hwAccel === 'nvenc') {
          pipeline += ' ! nvh265enc';
        } else {
          pipeline += ' ! x265enc tune=zerolatency';
        }
        break;
      case 'raw':
        // No encoding, just pass through
        break;
    }

    // Add bitrate control if specified
    if (config.bitrate && config.codec !== 'raw') {
      pipeline += ` bitrate=${config.bitrate}`;
    }

    // Output to stdout via appsink
    if (config.codec !== 'raw') {
      pipeline += ' ! mpegtsmux ! filesink location=/dev/stdout';
    } else {
      pipeline += ' ! appsink';
    }

    return pipeline;
  }

  private parseGStreamerCapabilities(output: string): DeviceCapabilities {
    const formats: any[] = [];
    const resolutions: Array<{ width: number; height: number }> = [];
    
    // Parse gst-device-monitor output
    if (output.includes('YUY2')) formats.push('YUYV');
    if (output.includes('image/jpeg')) formats.push('MJPEG');
    if (output.includes('NV12')) formats.push('NV12');

    // Extract resolution information
    const resMatches = output.match(/width=\(int\)(\d+).*?height=\(int\)(\d+)/g);
    if (resMatches) {
      resMatches.forEach(match => {
        const widthMatch = match.match(/width=\(int\)(\d+)/);
        const heightMatch = match.match(/height=\(int\)(\d+)/);
        
        if (widthMatch && heightMatch) {
          const width = parseInt(widthMatch[1]);
          const height = parseInt(heightMatch[1]);
          
          if (!resolutions.find(r => r.width === width && r.height === height)) {
            resolutions.push({ width, height });
          }
        }
      });
    }

    return {
      device: this.currentConfig?.device || '/dev/video0',
      supportedFormats: formats,
      supportedResolutions: resolutions,
      supportedFramerates: [15, 30, 60],
      hasHardwareAcceleration: output.includes('vaapi') || output.includes('nvenc')
    };
  }

  private handleError(error: Error): void {
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }
}

// src/adapters/AdapterFactory.ts
import { VideoCaptureAdapter } from './types';
import { V4L2Adapter } from './V4L2Adapter';
import { FFmpegAdapter } from './FFmpegAdapter';
import { GStreamerAdapter } from './GStreamerAdapter';

export type AdapterType = 'v4l2' | 'ffmpeg' | 'gstreamer';

export class AdapterFactory {
  static createAdapter(type: AdapterType): VideoCaptureAdapter {
    switch (type) {
      case 'v4l2':
        return new V4L2Adapter();
      case 'ffmpeg':
        return new FFmpegAdapter();
      case 'gstreamer':
        return new GStreamerAdapter();
      default:
        throw new Error(`Unknown adapter type: ${type}`);
    }
  }

  static async detectBestAdapter(): Promise<AdapterType> {
    // Check for available tools and return the best option
    const checks = [
      { type: 'gstreamer' as AdapterType, command: 'gst-launch-1.0' },
      { type: 'ffmpeg' as AdapterType, command: 'ffmpeg' },
      { type: 'v4l2' as AdapterType, command: 'v4l2-ctl' }
    ];

    for (const check of checks) {
      if (await this.commandExists(check.command)) {
        return check.type;
      }
    }

    throw new Error('No suitable video capture backend found');
  }

  private static async commandExists(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const process = spawn('which', [command]);
      
      process.on('close', (code: number) => {
        resolve(code === 0);
      });
      
      process.on('error', () => {
        resolve(false);
      });
    });
  }
}

// Example usage:
// src/services/CaptureService.ts
import { VideoCaptureAdapter, CaptureConfig, FrameData } from '../adapters/types';
import { AdapterFactory, AdapterType } from '../adapters/AdapterFactory';

export class CaptureService {
  private adapter: VideoCaptureAdapter;
  private onFrameCallback?: (frame: FrameData) => void;

  constructor(adapterType?: AdapterType) {
    if (adapterType) {
      this.adapter = AdapterFactory.createAdapter(adapterType);
    } else {
      // Auto-detect best adapter
      AdapterFactory.detectBestAdapter().then(type => {
        this.adapter = AdapterFactory.createAdapter(type);
      });
    }
  }

  async startCapture(config: CaptureConfig): Promise<void> {
    this.adapter.onFrame((frame) => {
      if (this.onFrameCallback) {
        this.onFrameCallback(frame);
      }
    });

    this.adapter.onError((error) => {
      console.error('Capture error:', error);
    });

    await this.adapter.startCapture(config);
  }

  async stopCapture(): Promise<void> {
    await this.adapter.stopCapture();
  }

  onFrame(callback: (frame: FrameData) => void): void {
    this.onFrameCallback = callback;
  }

  async getCapabilities(): Promise<any> {
    return await this.adapter.getCapabilities();
  }
}