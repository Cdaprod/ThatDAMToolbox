# video/modules/explorer/commands.py
"""
CLI verb:  video explore [--limit 20] | [--batch <id>]
Prints the same JSON the REST routes return.
"""
from argparse import Namespace
from video.cli import register
from .routes import list_recent, batch_detail     # re-use handlers

@register("explore", help="Explore recent artifacts or batches")
def cli_explore(args: Namespace):
    import asyncio, json
    if args.batch:
        data = asyncio.run(batch_detail(args.batch))  # type: ignore[arg-type]
    else:
        data = asyncio.run(list_recent(args.limit))
    print(json.dumps(data, indent=2))

def add_parser(sub):
    p = sub.add_parser("explore", help="Explorer view on CLI")
    p.add_argument("--limit", type=int, default=20)
    p.add_argument("--batch")