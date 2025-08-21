// video/web/static/components/ffmpeg-console.js

class FFMpegConsole {
  constructor(cfg){ this.cfg = cfg; }

  async init(){
    // UI refs
    this.quickSelect   = document.getElementById('ff-quick-select');
    this.fileInput     = document.getElementById('ff-file-input');
    this.assetSelect   = document.getElementById('ff-asset-select');
    this.outputNameEl  = document.getElementById('ff-output-name');
    this.txt           = document.getElementById('ff-input');
    this.btn           = document.getElementById('ff-run');
    this.histL         = document.getElementById('ff-history-list');
    this.out           = document.getElementById('ff-output');
    this.clearBtn      = document.getElementById('ff-clear-file');

    this.assetPath = '';
    this.localPath = '';

    // Enhanced Quick-command presets
    this.quickCommands = {
      // TRIMMING & CUTTING
      trimIdle: {
        cmd: 'ffmpeg -i "{{input}}" -vf "mpdecimate,setpts=N/FRAME_RATE/TB" -af "silenceremove=stop_periods=-1:stop_duration=2:stop_threshold=-30dB,asetpts=N/SR/TB" "{{output}}"',
        desc: 'Remove idle frames and silence'
      },
      
      trimTime: {
        cmd: 'ffmpeg -i "{{input}}" -ss 00:00:10 -to 00:01:30 -c copy "{{output}}"',
        desc: 'Trim from 10s to 1:30 (adjust times)'
      },
      
      trimDuration: {
        cmd: 'ffmpeg -i "{{input}}" -ss 00:00:05 -t 00:00:30 -c copy "{{output}}"',
        desc: 'Start at 5s, duration 30s'
      },

      // COMPRESSION & QUALITY
      compressH264: {
        cmd: 'ffmpeg -i "{{input}}" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k "{{output}}"',
        desc: 'H.264 compression (balanced quality)'
      },
      
      compressH265: {
        cmd: 'ffmpeg -i "{{input}}" -c:v libx265 -crf 28 -preset medium -c:a aac -b:a 128k "{{output}}"',
        desc: 'H.265 compression (smaller file)'
      },
      
      highQuality: {
        cmd: 'ffmpeg -i "{{input}}" -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k "{{output}}"',
        desc: 'High quality H.264'
      },
      
      webOptimized: {
        cmd: 'ffmpeg -i "{{input}}" -c:v libx264 -crf 23 -preset fast -movflags +faststart -c:a aac -b:a 128k "{{output}}"',
        desc: 'Web-optimized with fast start'
      },

      // RESOLUTION & SCALING
      scale720p: {
        cmd: 'ffmpeg -i "{{input}}" -vf "scale=1280:720" -c:a copy "{{output}}"',
        desc: 'Scale to 720p'
      },
      
      scale1080p: {
        cmd: 'ffmpeg -i "{{input}}" -vf "scale=1920:1080" -c:a copy "{{output}}"',
        desc: 'Scale to 1080p'
      },
      
      scale4K: {
        cmd: 'ffmpeg -i "{{input}}" -vf "scale=3840:2160" -c:a copy "{{output}}"',
        desc: 'Scale to 4K'
      },
      
      scaleHalf: {
        cmd: 'ffmpeg -i "{{input}}" -vf "scale=iw/2:ih/2" -c:a copy "{{output}}"',
        desc: 'Scale to half size'
      },

      // FRAME RATE
      fps30: {
        cmd: 'ffmpeg -i "{{input}}" -r 30 -c:a copy "{{output}}"',
        desc: 'Convert to 30fps'
      },
      
      fps60: {
        cmd: 'ffmpeg -i "{{input}}" -r 60 -c:a copy "{{output}}"',
        desc: 'Convert to 60fps'
      },
      
      fpsHalf: {
        cmd: 'ffmpeg -i "{{input}}" -vf "fps=fps=1/2:round=down" -c:a copy "{{output}}"',
        desc: 'Halve frame rate'
      },

      // AUDIO PROCESSING
      audioOnly: {
        cmd: 'ffmpeg -i "{{input}}" -vn -c:a copy "{{output}}"',
        desc: 'Extract audio only'
      },
      
      videoOnly: {
        cmd: 'ffmpeg -i "{{input}}" -an -c:v copy "{{output}}"',
        desc: 'Remove audio track'
      },
      
      audioNormalize: {
        cmd: 'ffmpeg -i "{{input}}" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:v copy "{{output}}"',
        desc: 'Normalize audio levels'
      },
      
      audioBoost: {
        cmd: 'ffmpeg -i "{{input}}" -af "volume=2.0" -c:v copy "{{output}}"',
        desc: 'Boost audio volume 2x'
      },

      // FILTERS & EFFECTS
      stabilize: {
        cmd: 'ffmpeg -i "{{input}}" -vf "vidstabdetect=shakiness=10:accuracy=15" -f null - && ffmpeg -i "{{input}}" -vf "vidstabtransform=smoothing=30:input=transforms.trf" "{{output}}"',
        desc: 'Stabilize shaky video (2-pass)'
      },
      
      denoise: {
        cmd: 'ffmpeg -i "{{input}}" -vf "nlmeans=s=1.0:p=7:r=15" -c:a copy "{{output}}"',
        desc: 'Reduce video noise'
      },
      
      sharpen: {
        cmd: 'ffmpeg -i "{{input}}" -vf "unsharp=5:5:1.0:5:5:0.0" -c:a copy "{{output}}"',
        desc: 'Sharpen video'
      },
      
      brightness: {
        cmd: 'ffmpeg -i "{{input}}" -vf "eq=brightness=0.1:contrast=1.2" -c:a copy "{{output}}"',
        desc: 'Adjust brightness/contrast'
      },
      
      saturation: {
        cmd: 'ffmpeg -i "{{input}}" -vf "eq=saturation=1.5" -c:a copy "{{output}}"',
        desc: 'Increase saturation'
      },
      
      grayscale: {
        cmd: 'ffmpeg -i "{{input}}" -vf "format=gray" -c:a copy "{{output}}"',
        desc: 'Convert to grayscale'
      },

      // ROTATION & FLIP
      rotate90: {
        cmd: 'ffmpeg -i "{{input}}" -vf "transpose=1" -c:a copy "{{output}}"',
        desc: 'Rotate 90° clockwise'
      },
      
      rotate180: {
        cmd: 'ffmpeg -i "{{input}}" -vf "transpose=2,transpose=2" -c:a copy "{{output}}"',
        desc: 'Rotate 180°'
      },
      
      rotate270: {
        cmd: 'ffmpeg -i "{{input}}" -vf "transpose=2" -c:a copy "{{output}}"',
        desc: 'Rotate 270° clockwise'
      },
      
      flipH: {
        cmd: 'ffmpeg -i "{{input}}" -vf "hflip" -c:a copy "{{output}}"',
        desc: 'Flip horizontally'
      },
      
      flipV: {
        cmd: 'ffmpeg -i "{{input}}" -vf "vflip" -c:a copy "{{output}}"',
        desc: 'Flip vertically'
      },

      // SPEED & TIMING
      speedUp2x: {
        cmd: 'ffmpeg -i "{{input}}" -vf "setpts=0.5*PTS" -af "atempo=2.0" "{{output}}"',
        desc: 'Speed up 2x'
      },
      
      slowDown2x: {
        cmd: 'ffmpeg -i "{{input}}" -vf "setpts=2.0*PTS" -af "atempo=0.5" "{{output}}"',
        desc: 'Slow down 2x'
      },
      
      speedUp4x: {
        cmd: 'ffmpeg -i "{{input}}" -vf "setpts=0.25*PTS" -af "atempo=2.0,atempo=2.0" "{{output}}"',
        desc: 'Speed up 4x'
      },

      // FORMAT CONVERSION
      toMp4: {
        cmd: 'ffmpeg -i "{{input}}" -c:v libx264 -c:a aac "{{output}}"',
        desc: 'Convert to MP4'
      },
      
      toWebM: {
        cmd: 'ffmpeg -i "{{input}}" -c:v libvpx-vp9 -c:a libopus "{{output}}"',
        desc: 'Convert to WebM'
      },
      
      toGif: {
        cmd: 'ffmpeg -i "{{input}}" -vf "fps=10,scale=480:-1:flags=lanczos,palettegen" -y palette.png && ffmpeg -i "{{input}}" -i palette.png -vf "fps=10,scale=480:-1:flags=lanczos,paletteuse" "{{output}}"',
        desc: 'Convert to GIF (2-pass)'
      },
      
      toMp3: {
        cmd: 'ffmpeg -i "{{input}}" -vn -c:a libmp3lame -b:a 192k "{{output}}"',
        desc: 'Extract as MP3'
      },

      // THUMBNAILS & PREVIEWS
      thumbnail: {
        cmd: 'ffmpeg -i "{{input}}" -ss 00:00:05 -vframes 1 -q:v 2 "{{output}}"',
        desc: 'Generate thumbnail at 5s'
      },
      
      preview: {
        cmd: 'ffmpeg -i "{{input}}" -vf "fps=1/10,scale=320:240" "{{output}}"',
        desc: 'Create preview (1 frame per 10s)'
      },
      
      contactSheet: {
        cmd: 'ffmpeg -i "{{input}}" -vf "fps=1/60,scale=160:120,tile=4x3" "{{output}}"',
        desc: 'Create contact sheet'
      },

      // WATERMARK & OVERLAY
      watermark: {
        cmd: 'ffmpeg -i "{{input}}" -vf "drawtext=text=\'Sample Text\':x=10:y=10:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.5" -c:a copy "{{output}}"',
        desc: 'Add text watermark'
      },
      
      timestamp: {
        cmd: 'ffmpeg -i "{{input}}" -vf "drawtext=text=\'%{localtime}\':x=10:y=10:fontsize=20:fontcolor=white" -c:a copy "{{output}}"',
        desc: 'Add timestamp overlay'
      },

      // BATCH OPERATIONS
      batchCompress: {
        cmd: 'for f in *.mp4; do ffmpeg -i "$f" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k "compressed_$f"; done',
        desc: 'Batch compress all MP4s'
      },
      
      batchResize: {
        cmd: 'for f in *.mp4; do ffmpeg -i "$f" -vf "scale=1280:720" -c:a copy "720p_$f"; done',
        desc: 'Batch resize to 720p'
      },

      // ANALYSIS & INFO
      analyze: {
        cmd: 'ffprobe -v quiet -print_format json -show_format -show_streams "{{input}}"',
        desc: 'Analyze video properties'
      },
      
      duration: {
        cmd: 'ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{{input}}"',
        desc: 'Get video duration'
      }
    };

    // When user picks a Quick Command, inject it into the textarea
    this.quickSelect.addEventListener('change', () => {
      const key = this.quickSelect.value;
      if (!this.quickCommands[key]) return;
      
      const inputPath = this.fileInput.files[0]?.name || this.assetPath || 'input.mp4';
      const fileName  = inputPath.split('/').pop();
      const output    = this.outputNameEl.value || this.getDefaultOutput(key, fileName);

      const cmd = this.quickCommands[key].cmd
                    .replace(/\{\{input\}\}/g, inputPath)
                    .replace(/\{\{output\}\}/g, output);
    
      this.txt.value = cmd;
    
      // Show description
      this.showCommandDescription(key);
    });
    
    // When user picks a file, infer output-name and store path
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files[0];
      if (!file) return;
      this.localPath = file.name;
      this.assetSelect.value = '';
      this.assetPath = '';
      // Only override if user hasn't typed something custom
      if (!this.outputNameEl.value || this.outputNameEl.value === this.lastInferred) {
        const [base, ext] = file.name.split(/\.(?=[^\.]+$)/);
        this.lastInferred = `${base}_processed.${ext || 'mp4'}`;
        this.outputNameEl.value = this.lastInferred;
      }
      // If a quick command is selected, update the command string
      if (this.quickSelect.value) {
        this.quickSelect.dispatchEvent(new Event('change'));
      }
    });

    // When user picks an asset, store its path
    this.assetSelect.addEventListener('change', () => {
      this.assetPath = this.assetSelect.value;
      this.fileInput.value = '';
      this.localPath = '';
      if (!this.outputNameEl.value || this.outputNameEl.value === this.lastInferred) {
        const file = this.assetPath.split('/').pop();
        const [base, ext] = file.split(/\.(?=[^\.]+$)/);
        this.lastInferred = `${base}_processed.${ext || 'mp4'}`;
        this.outputNameEl.value = this.lastInferred;
      }
      if (this.quickSelect.value) {
        this.quickSelect.dispatchEvent(new Event('change'));
      }
    });
    
    // Clear file handler
    this.clearBtn.addEventListener('click', () => {
      this.fileInput.value = '';
      this.txt.value       = '';
      this.outputNameEl.value = '';
      this.localPath = '';
    });

    // Populate the select dropdown
    this.populateQuickSelect();

    // Load available assets
    await this.loadAssets();

    // Load history
    await this.loadHistory();

    // Run wiring + arrow-key navigation
    this.btn.onclick = () => this.run();
    this.txt.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); this.cycleHist(-1); }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.cycleHist(+1); }
      if (e.key === 'Enter' && (e.metaKey||e.ctrlKey)) {
        e.preventDefault();
        this.run();
      }
    });
  }

  // Helper to get default output name based on command
  getDefaultOutput(commandKey, inputName) {
    const baseName = inputName.replace(/\.[^/.]+$/, '');
    const ext = inputName.split('.').pop();
    
    const outputMappings = {
      audioOnly: `${baseName}.mp3`,
      toMp4: `${baseName}.mp4`,
      toWebM: `${baseName}.webm`,
      toGif: `${baseName}.gif`,
      toMp3: `${baseName}.mp3`,
      thumbnail: `${baseName}_thumb.jpg`,
      preview: `${baseName}_preview.mp4`,
      contactSheet: `${baseName}_contact.jpg`,
      analyze: `${baseName}_info.json`
    };
    
    return outputMappings[commandKey] || `${baseName}_${commandKey}.${ext}`;
  }

  // Populate the select dropdown with grouped options
  populateQuickSelect() {
    const groups = {
      'Trimming & Cutting': ['trimIdle', 'trimTime', 'trimDuration'],
      'Compression & Quality': ['compressH264', 'compressH265', 'highQuality', 'webOptimized'],
      'Resolution & Scaling': ['scale720p', 'scale1080p', 'scale4K', 'scaleHalf'],
      'Frame Rate': ['fps30', 'fps60', 'fpsHalf'],
      'Audio Processing': ['audioOnly', 'videoOnly', 'audioNormalize', 'audioBoost'],
      'Filters & Effects': ['stabilize', 'denoise', 'sharpen', 'brightness', 'saturation', 'grayscale'],
      'Rotation & Flip': ['rotate90', 'rotate180', 'rotate270', 'flipH', 'flipV'],
      'Speed & Timing': ['speedUp2x', 'slowDown2x', 'speedUp4x'],
      'Format Conversion': ['toMp4', 'toWebM', 'toGif', 'toMp3'],
      'Thumbnails & Previews': ['thumbnail', 'preview', 'contactSheet'],
      'Watermark & Overlay': ['watermark', 'timestamp'],
      'Batch Operations': ['batchCompress', 'batchResize'],
      'Analysis & Info': ['analyze', 'duration']
    };

    this.quickSelect.innerHTML = '<option value="">Select a command...</option>';
    
    Object.entries(groups).forEach(([groupName, commands]) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = groupName;
      
      commands.forEach(cmd => {
        if (this.quickCommands[cmd]) {
          const option = document.createElement('option');
          option.value = cmd;
          option.textContent = `${cmd} - ${this.quickCommands[cmd].desc}`;
          optgroup.appendChild(option);
        }
      });
      
      this.quickSelect.appendChild(optgroup);
    });
  }

  // Show command description
  showCommandDescription(key) {
    const desc = this.quickCommands[key]?.desc;
    if (desc) {
      // You can display this in a tooltip or info area
      console.log(`Command: ${key} - ${desc}`);
    }
  }

  // Fetch assets from explorer and populate the dropdown
  async loadAssets(path='') {
    try {
      const res = await fetch(`/api/v1/explorer/assets?path=${encodeURIComponent(path)}`);
      const assets = await res.json();
      this.assetSelect.innerHTML = '<option value="">Choose asset…</option>';
      assets.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.path;
        opt.textContent = a.path;
        this.assetSelect.appendChild(opt);
      });
    } catch {
      this.assetSelect.innerHTML = '<option value="">(none)</option>';
    }
  }

  // helper: call JSON API
  async _apiJson(path, body){
    const res = await fetch(path, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // helper: call multipart/form-data API
  async _apiForm(path, form){
    const res = await fetch(path, {method:'POST', body: form});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // fetch & render history
  async loadHistory(limit=20){
    try {
      const res = await fetch(`/api/v1/ffmpeg/history?limit=${limit}`);
      this.hist = await res.json();
    } catch {
      this.hist = [];
    }
    this.hPtr = this.hist.length;
    this.histL.innerHTML = this.hist.map(h=>`
      <li style="margin-bottom:.5rem;">
        <code>${h.cmd.join(' ')}</code>
      </li>`).join('');
  }

  cycleHist(dir){
    if (!this.hist.length) return;
    this.hPtr = (this.hPtr + dir + this.hist.length) % this.hist.length;
    this.txt.value = this.hist[this.hPtr].cmd.join(' ');
  }

  // run: choose JSON vs FormData based on fileInput
  async run(){
    const cmd = this.txt.value.trim();
    if (!cmd) return;

    this.out.style.display = 'block';
    this.out.textContent   = '⏳ Running…';

    try {
      let res;
      if (this.fileInput.files[0]) {
        const form = new FormData();
        form.append('file',    this.fileInput.files[0]);
        form.append('cmd',     cmd);
        res = await this._apiForm('/api/v1/ffmpeg', form);
      } else {
        res = await this._apiJson('/api/v1/ffmpeg', {cmd});
      }

      this.out.textContent =
        `exit=${res.exit}  elapsed=${res.elapsed.toFixed(2)}s\n\n`+
        (res.stderr||res.stdout||'(no output)');

    } catch(err){
      this.out.textContent = `❌ ${err.message}`;
    }

    // refresh history afterwards
    await this.loadHistory();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new FFMpegConsole({}).init();
});