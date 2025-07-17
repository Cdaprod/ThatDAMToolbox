#!/usr/bin/env python3
import json
import uuid
import threading
import logging
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, parse_qs
from typing import Dict, Any
import os
from pathlib import Path
from enum import Enum

from .cli import run_cli_from_json

# In-memory job store with TTL
_jobs: Dict[str, Dict[str, Any]] = {}
_job_lock = threading.Lock()

class LogLevel(Enum):
    SILENT = 0
    ERROR = 1
    WARN = 2
    INFO = 3
    DEBUG = 4

class VideoAPILogger:
    def __init__(self, level: LogLevel = LogLevel.INFO):
        self.level = level
        self.logger = logging.getLogger("video.api")
        
        # Only configure if not already configured
        if not self.logger.handlers:
            logging.basicConfig(
                level=logging.INFO,
                format="%(asctime)s %(levelname)s %(message)s"
            )
    
    def set_level(self, level: LogLevel):
        """Change logging level"""
        self.level = level
    
    def error(self, msg: str, *args):
        if self.level.value >= LogLevel.ERROR.value:
            self.logger.error(msg, *args)
    
    def warn(self, msg: str, *args):
        if self.level.value >= LogLevel.WARN.value:
            self.logger.warning(msg, *args)
    
    def info(self, msg: str, *args):
        if self.level.value >= LogLevel.INFO.value:
            self.logger.info(msg, *args)
    
    def debug(self, msg: str, *args):
        if self.level.value >= LogLevel.DEBUG.value:
            self.logger.debug(msg, *args)
    
    def exception(self, msg: str, *args):
        if self.level.value >= LogLevel.ERROR.value:
            self.logger.exception(msg, *args)

# Global logger instance
api_logger = VideoAPILogger()

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle each request in its own thread."""
    daemon_threads = True  # Allow threads to die when main exits

class VideoAPIHandler(BaseHTTPRequestHandler):
    def _send_json(self, data: Dict[str, Any], status: int = 200):
        """Send JSON response with proper headers"""
        payload = json.dumps(data, indent=2).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_error(self, message: str, status: int = 400):
        """Send error response"""
        self._send_json({"error": message, "status": "error"}, status)

    def do_OPTIONS(self):
        """Handle CORS pre-flight requests"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        """Handle POST requests"""
        parsed = urlparse(self.path)
        path = parsed.path

        # Parse JSON body
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(body)
        except json.JSONDecodeError as e:
            return self._send_error(f"Invalid JSON: {e}")

        try:
            # --- BATCH CREATE WITH PRE-FLIGHT TRANSCODE ---
            if path == "/batches":
                name = data.get("name")
                paths = data.get("paths")
                skip_transcode = data.get("skip_transcode", False)
                
                if not name or not isinstance(paths, list):
                    return self._send_error("name (string) and paths (array) required")
                
                if not paths:
                    return self._send_error("paths array cannot be empty")

                job_id = str(uuid.uuid4())
                with _job_lock:
                    _jobs[job_id] = {
                        "status": "pending",
                        "created_at": time.time(),
                        "name": name,
                        "total_files": len(paths),
                        "processed_files": 0,
                        "current_file": None
                    }
                
                thread = threading.Thread(
                    target=self._process_batch,
                    args=(job_id, name, paths, skip_transcode),
                    daemon=True
                )
                thread.start()
                return self._send_json({
                    "job_id": job_id, 
                    "status": "started",
                    "message": f"Processing batch '{name}' with {len(paths)} files"
                }, 202)

            # --- SIMPLE TRANSCODE ENDPOINT ---
            elif path == "/transcode":
                src = data.get("src")
                dst = data.get("dst")
                codec = data.get("codec", "h264")
                
                if not src:
                    return self._send_error("src is required")
                
                if not dst:
                    # Auto-generate destination path
                    src_path = Path(src)
                    dst = str(src_path.parent / "_INCOMING" / src_path.name)
                
                try:
                    result = run_cli_from_json(json.dumps({
                        "action": "transcode",
                        "src": src, 
                        "dst": dst, 
                        "codec": codec
                    }))
                    return self._send_json({
                        "status": "ok", 
                        "dst": dst,
                        "result": json.loads(result) if result else None
                    })
                except Exception as e:
                    api_logger.error(f"Transcode failed for {src}: {e}")
                    return self._send_error(f"Transcode failed: {e}", 500)

            # --- DIRECT CLI COMMAND ---
            elif path == "/cli":
                command = data.get("command")
                if not command:
                    return self._send_error("command is required")
                
                try:
                    result = run_cli_from_json(json.dumps(command))
                    return self._send_json({
                        "status": "ok",
                        "result": json.loads(result) if result else None
                    })
                except Exception as e:
                    api_logger.error(f"CLI command failed: {e}")
                    return self._send_error(f"Command failed: {e}", 500)

            else:
                return self._send_error("Endpoint not found", 404)

        except Exception as e:
            api_logger.exception("POST request failed")
            return self._send_error(f"Internal server error: {e}", 500)

    def do_GET(self):
        """Handle GET requests"""
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        try:
            if path == "/health":
                return self._send_json({
                    "status": "ok",
                    "service": "video-api",
                    "active_jobs": len(_jobs),
                    "timestamp": time.time()
                })

            elif path == "/batches":
                # List batches
                try:
                    result = run_cli_from_json('{"action":"batches","cmd":"list"}')
                    return self._send_json(json.loads(result))
                except Exception as e:
                    api_logger.error(f"Failed to list batches: {e}")
                    return self._send_error(f"Failed to list batches: {e}", 500)

            elif path.startswith("/batches/") and path.count("/") == 2:
                # Show specific batch
                name = path.split("/batches/")[1]
                if not name:
                    return self._send_error("Batch name is required")
                
                try:
                    result = run_cli_from_json(json.dumps({
                        "action": "batches",
                        "cmd": "show",
                        "batch_name": name
                    }))
                    return self._send_json(json.loads(result))
                except Exception as e:
                    api_logger.error(f"Failed to get batch {name}: {e}")
                    return self._send_error(f"Failed to get batch: {e}", 500)

            elif path.startswith("/jobs/"):
                # Get job status
                job_id = path.split("/jobs/")[1]
                if not job_id:
                    return self._send_error("Job ID is required")
                
                with _job_lock:
                    job = _jobs.get(job_id)
                if not job:
                    return self._send_error("Job not found", 404)
                
                # Calculate progress
                job_copy = job.copy()
                if job_copy.get("total_files", 0) > 0:
                    job_copy["progress"] = job_copy.get("processed_files", 0) / job_copy["total_files"]
                
                return self._send_json(job_copy)

            elif path == "/jobs":
                # List all jobs
                with _job_lock:
                    jobs_summary = {}
                    for job_id, job_data in _jobs.items():
                        jobs_summary[job_id] = {
                            "status": job_data.get("status"),
                            "name": job_data.get("name"),
                            "created_at": job_data.get("created_at"),
                            "progress": job_data.get("processed_files", 0) / max(job_data.get("total_files", 1), 1)
                        }
                
                return self._send_json({"jobs": jobs_summary})

            else:
                return self._send_error("Endpoint not found", 404)

        except Exception as e:
            api_logger.exception("GET request failed")
            return self._send_error(f"Internal server error: {e}", 500)

    def do_DELETE(self):
        """Handle DELETE requests"""
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            if path.startswith("/batches/"):
                name = path.split("/batches/")[1]
                if not name:
                    return self._send_error("Batch name is required")
                
                try:
                    result = run_cli_from_json(json.dumps({
                        "action": "batches",
                        "cmd": "delete",
                        "batch_name": name
                    }))
                    return self._send_json(json.loads(result))
                except Exception as e:
                    api_logger.error(f"Failed to delete batch {name}: {e}")
                    return self._send_error(f"Failed to delete batch: {e}", 500)

            elif path.startswith("/jobs/"):
                job_id = path.split("/jobs/")[1]
                if not job_id:
                    return self._send_error("Job ID is required")
                
                with _job_lock:
                    if job_id in _jobs:
                        del _jobs[job_id]
                        return self._send_json({"status": "ok", "message": "Job deleted"})
                    else:
                        return self._send_error("Job not found", 404)

            else:
                return self._send_error("Endpoint not found", 404)

        except Exception as e:
            api_logger.exception("DELETE request failed")
            return self._send_error(f"Internal server error: {e}", 500)

    def _process_batch(self, job_id: str, name: str, paths: list[str], skip_transcode: bool = False):
        """Process batch in background thread"""
        try:
            with _job_lock:
                _jobs[job_id]["status"] = "transcoding" if not skip_transcode else "creating_batch"
            
            api_logger.info(f"Starting batch '{name}' with {len(paths)} files (skip_transcode={skip_transcode})")
            
            transcoded_paths = []
            
            if not skip_transcode:
                # 1) Pre-flight: transcode each file into _INCOMING/
                for i, src in enumerate(paths):
                    with _job_lock:
                        _jobs[job_id]["current_file"] = src
                        _jobs[job_id]["processed_files"] = i
                    
                    # Only log progress occasionally
                    if i % 10 == 0 or i == len(paths) - 1:
                        api_logger.debug(f"Transcoding progress for batch '{name}': {i+1}/{len(paths)}")
                    
                    # Create destination path
                    src_path = Path(src)
                    dst_dir = src_path.parent / "_INCOMING"
                    dst_dir.mkdir(exist_ok=True)
                    dst = str(dst_dir / src_path.name)
                    
                    try:
                        run_cli_from_json(json.dumps({
                            "action": "transcode",
                            "src": src,
                            "dst": dst,
                            "codec": "h264"
                        }))
                        transcoded_paths.append(dst)
                    except Exception as e:
                        api_logger.error(f"Failed to transcode {src}: {e}")
                        transcoded_paths.append(src)
            else:
                transcoded_paths = paths

            # 2) Create the batch
            with _job_lock:
                _jobs[job_id]["status"] = "creating_batch"
                _jobs[job_id]["current_file"] = None
            
            result = run_cli_from_json(json.dumps({
                "action": "batches",
                "cmd": "create",
                "name": name,
                "paths": transcoded_paths
            }))
            
            with _job_lock:
                _jobs[job_id] = {
                    **_jobs[job_id],
                    "status": "completed",
                    "result": json.loads(result),
                    "processed_files": len(paths),
                    "completed_at": time.time()
                }
            
            api_logger.info(f"Batch '{name}' completed successfully")

        except Exception as e:
            api_logger.exception(f"Batch job {job_id} failed")
            with _job_lock:
                _jobs[job_id] = {
                    **_jobs[job_id],
                    "status": "error",
                    "error": str(e),
                    "failed_at": time.time()
                }

    def log_message(self, fmt, *args):
        """Route http.server logging through our logger - minimal logging"""
        message = fmt % args
        if any(indicator in message.lower() for indicator in ['error', 'failed', 'exception']):
            api_logger.warn(message)
        else:
            api_logger.debug(message)


def cleanup_old_jobs():
    """Background thread to clean up old jobs"""
    while True:
        try:
            time.sleep(300)  # Check every 5 minutes
            current_time = time.time()
            with _job_lock:
                expired_jobs = [
                    job_id for job_id, job_data in _jobs.items()
                    if current_time - job_data.get("created_at", 0) > 3600  # 1 hour
                ]
                if expired_jobs:
                    api_logger.info(f"Cleaning up {len(expired_jobs)} expired jobs")
                    for job_id in expired_jobs:
                        del _jobs[job_id]
        except Exception as e:
            api_logger.exception("Job cleanup failed")


def serve(host="0.0.0.0", port=8080, log_level: LogLevel = LogLevel.INFO, show_startup_info: 