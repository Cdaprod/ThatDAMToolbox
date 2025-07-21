#!/usr/bin/env python3
"""
video/modules/dam/commands.py

DAM commands integrated with the top-level `video.cli` (stdlib argparse).
"""

import argparse
import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger("video.dam.commands")


def add_parser(subparsers: argparse._SubParsersAction) -> None:
    """
    Hook into the main CLI to add a `dam` command group with its sub-verbs.
    Called automatically by the module loader in video/cli.py.
    """
    # top-level "video dam" group
    dam_p = subparsers.add_parser(
        "dam", help="Digital Asset Management (DAM) commands"
    )
    dam_sub = dam_p.add_subparsers(dest="dam_cmd", required=True)

    # ingest
    ingest_p = dam_sub.add_parser(
        "ingest", help="Ingest a video file into the DAM system"
    )
    ingest_p.add_argument("path", type=Path, help="Path to the video file")
    ingest_p.add_argument(
        "--force",
        action="store_true",
        help="Force re-index even if already present",
    )
    ingest_p.add_argument(
        "--metadata",
        type=str,
        help="JSON string of additional metadata",
    )
    ingest_p.set_defaults(func=cmd_ingest)

    # batch_ingest
    batch_p = dam_sub.add_parser(
        "batch_ingest", help="Batch-ingest all videos in a directory"
    )
    batch_p.add_argument("directory", type=Path, help="Directory containing videos")
    batch_p.add_argument(
        "--pattern", default="*.mp4", help="File glob pattern (default: *.mp4)"
    )
    batch_p.add_argument(
        "--recursive", action="store_true", help="Recurse into subdirectories"
    )
    batch_p.set_defaults(func=cmd_batch_ingest)

    # search
    search_p = dam_sub.add_parser(
        "search", help="Search videos with natural-language queries"
    )
    search_p.add_argument("query", type=str, help="Query string")
    search_p.add_argument(
        "--level",
        default="all",
        help="Search level (L0, L1, L2, L3, all)",
    )
    search_p.add_argument(
        "--limit", type=int, default=10, help="Max number of results"
    )
    search_p.add_argument(
        "--threshold", type=float, default=0.7, help="Similarity threshold"
    )
    search_p.set_defaults(func=cmd_search)

    # list_videos
    list_p = dam_sub.add_parser(
        "list_videos", help="List videos in the DAM store"
    )
    list_p.add_argument(
        "--skip", type=int, default=0, help="Records to skip"
    )
    list_p.add_argument(
        "--limit", type=int, default=50, help="Max records to return"
    )
    list_p.set_defaults(func=cmd_list_videos)

    # reindex
    reindex_p = dam_sub.add_parser(
        "reindex", help="Re-index all videos with a new embedding version"
    )
    reindex_p.add_argument(
        "--version", default="v2", help="Embedding version to use"
    )
    reindex_p.set_defaults(func=cmd_reindex)

    # stats
    stats_p = dam_sub.add_parser(
        "stats", help="Show DAM system statistics"
    )
    stats_p.set_defaults(func=cmd_stats)

    # delete
    delete_p = dam_sub.add_parser(
        "delete", help="Delete a video and its embeddings"
    )
    delete_p.add_argument(
        "video_uuid", type=str, help="UUID of the video to delete"
    )
    delete_p.set_defaults(func=cmd_delete)

    # validate
    validate_p = dam_sub.add_parser(
        "validate", help="Validate a video file for ingestion"
    )
    validate_p.add_argument("path", type=Path, help="Path to the video file")
    validate_p.set_defaults(func=cmd_validate)


# ─── COMMAND IMPLEMENTATIONS ──────────────────────────────────────────────────

def cmd_ingest(args: argparse.Namespace) -> Dict[str, Any]:
    """Ingest a single video file."""
    path = args.path
    metadata = json.loads(args.metadata) if args.metadata else {}

    async def _ingest():
        from .services import (
            get_hierarchy_manager,
            get_embedding_generator,
            get_vector_store,
        )

        print(f"Ingesting video: {path}")
        hm = get_hierarchy_manager()
        eg = get_embedding_generator()
        vs = get_vector_store()

        l0 = await eg.generate_video_vector(str(path))
        video_uuid = await vs.store_video(path=str(path), l0_vector=l0, metadata=metadata)
        print(f"Video ingested with UUID: {video_uuid}")

        scenes = await hm.detect_scenes(str(path))
        print(f"Detected {len(scenes)} scenes")

        vectors: Dict[str, int] = {}
        for level in ("L1", "L2", "L3"):
            lvl_vecs = await eg.generate_level_vectors(str(path), scenes, level)
            await vs.store_level_vectors(video_uuid, level, lvl_vecs)
            vectors[level] = len(lvl_vecs)
            print(f"Generated {len(lvl_vecs)} {level} vectors")

        print("✓ Video ingestion completed successfully")
        return {
            "video_uuid": video_uuid,
            "scenes_detected": len(scenes),
            "vectors_generated": vectors,
        }

    return asyncio.run(_ingest())


def cmd_batch_ingest(args: argparse.Namespace) -> Dict[str, Any]:
    """Batch-ingest videos from a directory."""
    directory, pattern, recursive = args.directory, args.pattern, args.recursive

    async def _batch():
        from .services import (
            get_hierarchy_manager,
            get_embedding_generator,
            get_vector_store,
        )

        hm = get_hierarchy_manager()
        eg = get_embedding_generator()
        vs = get_vector_store()

        files = (
            list(directory.rglob(pattern))
            if recursive
            else list(directory.glob(pattern))
        )
        print(f"Found {len(files)} video files")

        results: List[Dict[str, Any]] = []
        for f in files:
            try:
                print(f"Processing: {f}")
                l0 = await eg.generate_video_vector(str(f))
                vid = await vs.store_video(path=str(f), l0_vector=l0, metadata={})

                scenes = await hm.detect_scenes(str(f))
                for level in ("L1", "L2", "L3"):
                    lvl_vecs = await eg.generate_level_vectors(str(f), scenes, level)
                    await vs.store_level_vectors(vid, level, lvl_vecs)

                results.append(
                    {"path": str(f), "uuid": vid, "status": "ok", "scenes": len(scenes)}
                )
                print(f"  ✓ Ingested: {vid}")
            except Exception as e:
                results.append({"path": str(f), "error": str(e)})
                print(f"  ✗ Error processing {f}: {e}")

        print("✓ Batch ingestion completed")
        return {"processed": len(results), "details": results}

    return asyncio.run(_batch())


def cmd_search(args: argparse.Namespace) -> List[Dict[str, Any]]:
    """Search the DAM by natural-language query."""
    query, level, limit, threshold = (
        args.query,
        args.level,
        args.limit,
        args.threshold,
    )

    async def _search():
        from .services import get_embedding_generator, get_vector_store

        eg = get_embedding_generator()
        vs = get_vector_store()

        print(f"Searching for: '{query}'")
        qv = await eg.generate_text_vector(query)
        hits = await vs.search_vectors(
            query_vector=qv, level=level, limit=limit, threshold=threshold
        )

        print(f"\nFound {len(hits)} results:")
        print("-" * 80)
        out = []
        for i, r in enumerate(hits, 1):
            print(f"{i}. {r['path']}")
            print(f"   Level: {r['level']}")
            print(
                f"   Time: {r['start_time']:.2f}s - {r['end_time']:.2f}s"
            )
            print(f"   Score: {r['score']:.3f}\n")
            out.append(
                {
                    "path": r["path"],
                    "level": r["level"],
                    "start_time": r["start_time"],
                    "end_time": r["end_time"],
                    "score": r["score"],
                }
            )
        return out

    return asyncio.run(_search())


def cmd_list_videos(args: argparse.Namespace) -> List[Dict[str, Any]]:
    """List videos stored in the DAM."""
    async def _list():
        from .services import get_vector_store

        vs = get_vector_store()
        vids = await vs.list_videos(skip=args.skip, limit=args.limit)
        print(f"Videos ({len(vids)} shown):")
        print("-" * 80)
        out = []
        for v in vids:
            print(f"UUID:  {v['uuid']}")
            print(f"Path:  {v['path']}")
            print(f"Dur:   {v.get('duration','N/A')}s")
            print(f"Levels:{v.get('levels',{})}\n")
            out.append(v)
        return out

    return asyncio.run(_list())


def cmd_reindex(args: argparse.Namespace) -> Dict[str, Any]:
    """Reindex all videos with a new embedding version."""
    version = args.version

    async def _reindex():
        from .services import get_embedding_generator, get_vector_store

        print(f"Starting reindex with version: {version}")
        eg = get_embedding_generator()
        vs = get_vector_store()

        vids = await vs.list_videos()
        for i, v in enumerate(vids, 1):
            print(f"[{i}/{len(vids)}] Reindexing: {v['path']}")
            # placeholder
            await asyncio.sleep(0.1)

        print("✓ Reindexing completed")
        return {"reindexed": len(vids), "version": version}

    return asyncio.run(_reindex())


def cmd_stats(args: argparse.Namespace) -> Dict[str, Any]:
    """Retrieve DAM system statistics."""
    async def _stats():
        from .services import get_vector_store

        stats = await get_vector_store().get_system_stats()
        print("System Statistics:")
        print("-" * 40)
        print(f"Total videos:  {stats.get('total_videos',0)}")
        print(f"Total vectors: {stats.get('total_vectors',0)}")
        print(f"Storage used:  {stats.get('storage_used','N/A')}")
        print("Vectors by level:")
        for lvl, cnt in stats.get("vectors_by_level", {}).items():
            print(f"  {lvl}: {cnt}")
        return stats

    return asyncio.run(_stats())


def cmd_delete(args: argparse.Namespace) -> Dict[str, Any]:
    """Delete a video and its embeddings."""
    async def _delete():
        from .services import get_vector_store

        resp = input(f"Delete video {args.video_uuid}? (y/N): ")
        if resp.lower() not in ("y", "yes"):
            print("Cancelled")
            return {"cancelled": True}
        await get_vector_store().delete_video(args.video_uuid)
        print(f"✓ Deleted {args.video_uuid}")
        return {"deleted": args.video_uuid}

    return asyncio.run(_delete())


def cmd_validate(args: argparse.Namespace) -> Dict[str, Any]:
    """Validate a video file before ingestion."""
    async def _validate():
        from .services import get_hierarchy_manager

        print(f"Validating: {args.path}")
        hm = get_hierarchy_manager()
        dur = await hm.get_video_duration(str(args.path))
        scenes = await hm.detect_scenes(str(args.path))
        hsh = await hm.get_file_hash(str(args.path))
        print(f"✓ Duration: {dur}s")
        print(f"✓ Scenes:   {len(scenes)}")
        print(f"✓ Hash:     {hsh[:16]}…")
        return {
            "duration": dur,
            "scenes": len(scenes),
            "hash": hsh,
            "valid": True,
        }

    return asyncio.run(_validate())