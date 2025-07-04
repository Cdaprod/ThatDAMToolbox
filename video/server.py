#!/usr/bin/env python3
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from io import StringIO
import sys
import logging

from .cli import run_cli

class VideoAPIHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        payload = self.rfile.read(content_length)
        # Forward JSON to your CLI dispatcher
        sys.stdin = StringIO(payload.decode())   # monkeypatch for run_cli()
        sys.argv = [sys.argv[0]]                # clear argv so run_cli uses stdin
        # Capture stdout
        old_stdout = sys.stdout
        sys.stdout = StringIO()
        try:
            run_cli()
            output = sys.stdout.getvalue()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(output.encode())
        except Exception as e:
            logging.exception("Error in API handler")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
        finally:
            sys.stdout = old_stdout

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path, query = parsed_url.path, parse_qs(parsed_url.query)

        if path == "/batches":
            sys.stdin = StringIO('{"action":"batches","cmd":"list"}')
        elif path == "/batch":
            batch_name = query.get("name", [""])[0]
            if not batch_name:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error":"batch name is required"}')
                return
            sys.stdin = StringIO(json.dumps({
                "action": "batches",
                "cmd": "show",
                "batch_name": batch_name
            }))
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error":"unknown endpoint"}')
            return

        # Capture output
        old_stdout = sys.stdout
        sys.stdout = StringIO()
        try:
            run_cli()
            output = sys.stdout.getvalue()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(output.encode())
        except Exception as e:
            logging.exception("API Error")
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())
        finally:
            sys.stdout = old_stdout


def serve(host="0.0.0.0", port=8080):
    server = HTTPServer((host, port), VideoAPIHandler)
    print(f"Serving video API at http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    serve()