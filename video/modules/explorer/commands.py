#!/usr/bin/env python3
"""
/video/modules/explorer/commands.py

CLI verb:  video explore [--limit 20] | [--batch <id>]
Prints the same JSON the REST routes return.
"""
from __future__ import annotations

import asyncio, json
from argparse import Namespace
from video.cli     import register
from .routes       import list_recent, batch_detail       # reuse the async handlers

@register("explore", help="Explorer – recent feed or one batch")
def cli_explore(args: Namespace) -> None:
    """
    `video explore`              → recent feed (limit 20)
    `video explore --limit 5`    → recent feed (5)
    `video explore --batch <id>` → full batch manifest/cards
    """
    coro = batch_detail(args.batch) if args.batch else list_recent(args.limit)  # type: ignore[arg-type]
    data = asyncio.run(coro)
    # Pydantic model → dict → pretty JSON
    print(json.dumps(data.model_dump(), indent=2))

def add_parser(sub) -> None:
    p = sub.add_parser("explore", help="Explorer feed / batch view")
    p.add_argument("--limit", type=int, default=20)
    p.add_argument("--batch", help="Batch ID to inspect")