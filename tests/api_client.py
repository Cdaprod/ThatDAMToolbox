#!/usr/bin/env python3
"""
Typed, ergonomic client for the Video-API.
Can be imported (for tests) *or* executed directly::

    python api_client.py --stats
"""
from __future__ import annotations
import json, sys
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

import requests

JSONDict = Dict[str, Any]

class APIError(Exception): ...
class VideoAPIClient:
    def __init__(self, base_url: str = "http://localhost:8080", timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.session  = requests.Session()
        self.timeout  = timeout

    # ─────────────────────────── helpers ────────────────────────────
    def _url(self, ep: str) -> str:                   # convenience
        return f"{self.base_url}{ep}"

    def _request(self, method: str, ep: str, **kw) -> JSONDict:
        r = self.session.request(method, self._url(ep), timeout=self.timeout, **kw)
        try:
            r.raise_for_status()
            return r.json() if r.content else {}
        except requests.RequestException as exc:
            raise APIError(f"{method} {ep} → {exc}") from exc

    # ─────────────────────────── endpoints ──────────────────────────
    ## health / stats
    def health(self)           -> JSONDict: return self._request("GET", "/health")
    def stats(self)            -> JSONDict: return self._request("GET", "/stats")
    def recent(self, limit=10) -> JSONDict: return self._request("GET", f"/recent?limit={limit}")

    ## batches
    def batches(self)               -> JSONDict: return self._request("GET", "/batches")
    def batch(self, name: str)      -> JSONDict: return self._request("GET", f"/batches/{name}")
    def new_batch(self, name: str, paths: Iterable[str]) -> JSONDict:
        return self._request("POST", "/batches", json={"name": name, "paths": list(paths)})
    def drop_batch(self, name: str) -> JSONDict: return self._request("DELETE", f"/batches/{name}")

    ## scan / search
    def scan(self, directory: str, recursive=True) -> JSONDict:
        return self._request("POST", "/scan", json={"directory": directory, "recursive": recursive})
    def search(self, query: str, limit=10) -> JSONDict:
        return self._request("POST", "/search", json={"query": query, "limit": limit})

    ## paths
    def paths(self)               -> JSONDict: return self._request("GET", "/paths")
    def add_path(self, name, path)-> JSONDict: return self._request("POST", "/paths", json={"name":name,"path":path})
    def rm_path(self, name)       -> JSONDict: return self._request("DELETE", f"/paths/{name}")

    ## misc
    def sync_album(self, album) -> JSONDict: return self._request("POST", "/sync_album", json={"album": album})
    def backup(self, src, dst=None)->JSONDict:
        payload={"source":src}; 
        if dst: payload["destination"]=dst
        return self._request("POST", "/backup", json=payload)

# ─────────────────────────── CLI demo ───────────────────────────────
def _pretty(obj): print(json.dumps(obj, indent=2))

def main(argv: list[str] | None = None):
    import argparse, textwrap
    argv = argv or sys.argv[1:]
    pa = argparse.ArgumentParser(
        prog="api_client",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=textwrap.dedent("""\
            Handy one-shot utility around the Video-API.

            Examples:
              api_client.py --health
              api_client.py --batches
              api_client.py --search mp4
        """))
    pa.add_argument("--base", default="http://localhost:8080")
    g = pa.add_mutually_exclusive_group(required=True)
    g.add_argument("--health",   action="store_true")
    g.add_argument("--stats",    action="store_true")
    g.add_argument("--batches",  action="store_true")
    g.add_argument("--recent",   type=int, metavar="N")
    g.add_argument("--search",   metavar="QUERY")
    args = pa.parse_args(argv)

    cli = VideoAPIClient(args.base)
    if args.health:  _pretty(cli.health())
    if args.stats:   _pretty(cli.stats())
    if args.batches: _pretty(cli.batches())
    if args.recent is not None: _pretty(cli.recent(args.recent))
    if args.search:  _pretty(cli.search(args.search))

if __name__ == "__main__":
    main()