#!/usr/bin/env python3
"""
/video/modules/explorer/commands.py

CLI verb:  video explore [--limit 20] | [--batch <id>]
Prints the same JSON the REST routes return – but without relying on
FastAPI’s Request/Depends machinery.
"""
from __future__ import annotations

import json
import logging
import sys
from argparse import Namespace

from video.cli import register
from video.core import get_manifest
from video.bootstrap import STORAGE               # the AutoStorage singleton
from video.models import CardResponse
from .routes import _rows_to_cards, _manifest_to_cards  # reuse converters

log = logging.getLogger("video.explorer.cli")


@register("explore", help="Explorer – recent feed or one batch")
def cli_explore(args: Namespace) -> None:
    """
    • `video explore`              → recent feed (default limit 20)  
    • `video explore --limit 5`    → recent feed (limit 5)  
    • `video explore --batch <id>` → full batch manifest/cards
    """
    store = STORAGE                     # same instance FastAPI uses

    # ---------------- Recent feed -----------------
    if not args.batch:
        rows  = store.list_recent(args.limit)
        model = CardResponse(batch_id="_recent",
                             items=_rows_to_cards(rows))
        log.info("recent feed – %d rows (limit=%d)", len(rows), args.limit)

    # ---------------- Batch manifest -------------
    else:
        manifest = get_manifest(args.batch)
        if manifest is None:
            log.error("batch %s not found", args.batch)
            print(f"❌ batch '{args.batch}' not found", file=sys.stderr)
            sys.exit(1)

        model = CardResponse(batch_id=args.batch,
                             items=_manifest_to_cards(manifest))
        log.info("batch %s – %d artefacts", args.batch,
                 len(manifest['artifacts']))

    # Serialise **exactly** like the REST layer
    print(json.dumps(model.model_dump(), indent=2))


def add_parser(sub) -> None:
    p = sub.add_parser("explore", help="Explorer feed / batch view")
    p.add_argument("--limit", type=int, default=20,
                   help="Number of recent items to return")
    p.add_argument("--batch", help="Batch ID to inspect")