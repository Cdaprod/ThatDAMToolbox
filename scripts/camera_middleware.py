#!/usr/bin/env python3
import os, subprocess, time, json, threading
from flask import Flask, jsonify

CAMERA_DB = '/tmp/camera_map.json'

def list_cameras():
    # Find all video devices
    devices = [f for f in os.listdir('/dev') if f.startswith('video')]
    return sorted(['/dev/' + d for d in devices])

def get_device_capabilities(device):
    try:
        out = subprocess.check_output(['v4l2-ctl', '--device', device, '--all'], encoding='utf-8')
        return out
    except Exception as e:
        return str(e)

def select_backend(device):
    # Very naive: can add smarter detection
    caps = get_device_capabilities(device)
    if 'H.264' in caps: return 'ffmpeg'
    if 'MJPG' in caps: return 'v4l2'
    return 'gstreamer'

def camera_monitor_loop():
    known = {}
    while True:
        cams = list_cameras()
        changed = False
        for idx, device in enumerate(cams):
            if device not in known:
                backend = select_backend(device)
                known[device] = {'index': idx, 'backend': backend}
                changed = True
        # Remove disconnected devices
        for device in list(known.keys()):
            if device not in cams:
                del known[device]
                changed = True
        if changed:
            with open(CAMERA_DB, 'w') as f:
                json.dump(known, f)
        time.sleep(5)

def start_monitor_thread():
    t = threading.Thread(target=camera_monitor_loop, daemon=True)
    t.start()

# --- Minimal API for status/command ---
app = Flask(__name__)

@app.route('/status')
def status():
    if os.path.exists(CAMERA_DB):
        with open(CAMERA_DB) as f:
            return jsonify(json.load(f))
    return jsonify({})

@app.route('/start/<device>')
def start_stream(device):
    # Example: start streaming using detected backend
    return jsonify({'started': device})

if __name__ == "__main__":
    start_monitor_thread()
    app.run(host='127.0.0.1', port=7788)