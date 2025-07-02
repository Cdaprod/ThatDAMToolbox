#!/usr/bin/env python3
"""
Wrapper to call the video package from Pythonista via Script Path.
"""
import sys, json
from video import MediaIndexer   # absolute import

def main():
    raw = sys.stdin.read()
    args = json.loads(raw) if raw.strip() else {}
    action = args.get("action", "stats")
    idx = MediaIndexer()
    if action == "scan":
        res = idx.scan(root_path=args.get("root"), workers=args.get("workers", 4))
    elif action == "sync_album":
        res = idx.sync.sync_album_from_args(args)
    elif action == "stats":
        res = idx.get_stats()
    elif action == "recent":
        res = idx.get_recent(limit=args.get("limit", 10))
    else:
        res = {"error": f"Unknown action {action!r}"}
    print(json.dumps(res, ensure_ascii=False))

if __name__ == "__main__":
    main()