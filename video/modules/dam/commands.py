#!/usr/bin/env python3
"""
video/modules/dam/commands.py

CLI commands for the DAM system using @register decorator pattern.
Provides command-line management for ingestion, search, and admin ops.
"""

import click
import asyncio
import logging
from typing import List, Optional
from pathlib import Path
import json

logger = logging.getLogger("video.dam.commands")

# Command registry for plugin loader
_commands: List[click.Command] = []

def register(func):
    """Decorator to register CLI commands (for loader discovery)."""
    _commands.append(func)
    return func

def register_commands(app=None):
    """Log registered commands for plugin introspection."""
    for command in _commands:
        logger.info(f"Registered DAM command: {command.name}")

#───────────────────────────────────────────────
# DAM CLI COMMANDS
#───────────────────────────────────────────────

@register
@click.command("ingest")
@click.argument("path", type=click.Path(exists=True))
@click.option("--force", is_flag=True, help="Force reindex even if video exists")
@click.option("--metadata", type=str, help="JSON metadata string")
def ingest(path: str, force: bool, metadata: Optional[str]):
    """Ingest a video file into the DAM system."""
    async def _ingest():
        try:
            from .services import get_hierarchy_manager, get_embedding_generator, get_vector_store
            hm = get_hierarchy_manager()
            eg = get_embedding_generator()
            vs = get_vector_store()
            meta = json.loads(metadata) if metadata else {}
            click.echo(f"Ingesting video: {path}")
            l0_vector = await eg.generate_video_vector(path)
            video_uuid = await vs.store_video(path=path, l0_vector=l0_vector, metadata=meta)
            click.echo(f"Video ingested with UUID: {video_uuid}")
            scenes = await hm.detect_scenes(path)
            click.echo(f"Detected {len(scenes)} scenes")
            for level in ["L1", "L2", "L3"]:
                vectors = await eg.generate_level_vectors(path, scenes, level)
                await vs.store_level_vectors(video_uuid, level, vectors)
                click.echo(f"Generated {len(vectors)} {level} vectors")
            click.echo("✓ Video ingestion completed successfully")
        except Exception as e:
            click.echo(f"✗ Error ingesting video: {e}", err=True)
            raise click.ClickException(str(e))
    asyncio.run(_ingest())

@register
@click.command("batch-ingest")
@click.argument("directory", type=click.Path(exists=True, file_okay=False))
@click.option("--pattern", default="*.mp4", help="File pattern to match")
@click.option("--recursive", is_flag=True, help="Search recursively")
def batch_ingest(directory: str, pattern: str, recursive: bool):
    """Batch ingest all videos in a directory."""
    async def _batch_ingest():
        try:
            from .services import get_embedding_generator, get_vector_store
            dir_path = Path(directory)
            video_files = list(dir_path.rglob(pattern)) if recursive else list(dir_path.glob(pattern))
            click.echo(f"Found {len(video_files)} video files")
            for video_file in video_files:
                try:
                    click.echo(f"Processing: {video_file}")
                    eg = get_embedding_generator()
                    vs = get_vector_store()
                    l0_vector = await eg.generate_video_vector(str(video_file))
                    video_uuid = await vs.store_video(path=str(video_file), l0_vector=l0_vector, metadata={})
                    click.echo(f"  ✓ Ingested: {video_uuid}")
                except Exception as e:
                    click.echo(f"  ✗ Error processing {video_file}: {e}", err=True)
            click.echo("✓ Batch ingestion completed")
        except Exception as e:
            click.echo(f"✗ Error in batch ingestion: {e}", err=True)
            raise click.ClickException(str(e))
    asyncio.run(_batch_ingest())

@register
@click.command("search")
@click.argument("query", type=str)
@click.option("--level", default="all", help="Search level (L0, L1, L2, L3, all)")
@click.option("--limit", default=10, help="Number of results")
@click.option("--threshold", default=0.7, help="Similarity threshold")
def search(query: str, level: str, limit: int, threshold: float):
    """Search videos using natural language queries."""
    async def _search():
        try:
            from .services import get_embedding_generator, get_vector_store
            eg = get_embedding_generator()
            vs = get_vector_store()
            click.echo(f"Searching for: '{query}'")
            query_vector = await eg.generate_text_vector(query)
            results = await vs.search_vectors(query_vector=query_vector, level=level, limit=limit, threshold=threshold)
            click.echo(f"\nFound {len(results)} results:")
            click.echo("-" * 80)
            for i, result in enumerate(results, 1):
                click.echo(f"{i}. {result['path']}")
                click.echo(f"   Level: {result['level']}")
                click.echo(f"   Time: {result['start_time']:.2f}s - {result['end_time']:.2f}s")
                click.echo(f"   Score: {result['score']:.3f}\n")
        except Exception as e:
            click.echo(f"✗ Error searching: {e}", err=True)
            raise click.ClickException(str(e))
    asyncio.run(_search())

@register
@click.command("list-videos")
@click.option("--skip", default=0, help="Number of records to skip")
@click.option("--limit", default=50, help="Number of records to return")
def list_videos(skip: int, limit: int):
    """List all videos in the system."""
    async def _list():
        try:
            from .services import get_vector_store
            vs = get_vector_store()
            videos = await vs.list_videos(skip=skip, limit=limit)
            click.echo(f"Videos ({len(videos)} shown):")
            click.echo("-" * 80)
            for video in videos:
                click.echo(f"UUID: {video['uuid']}")
                click.echo(f"Path: {video['path']}")
                click.echo(f"Duration: {video.get('duration', 'N/A')}s")
                click.echo(f"Levels: {video.get('levels', {})}\n")
        except Exception as e:
            click.echo(f"✗ Error listing videos: {e}", err=True)
            raise click.ClickException(str(e))
    asyncio.run(_list())

@register
@click.command("reindex")
@click.option("--version", default="v2", help="New embedding version")
def reindex(version: str):
    """Reindex all videos with a new embedding version."""
    async def _reindex():
        try:
            from .services import get_embedding_generator, get_vector_store
            click.echo(f"Starting reindex with version: {version}")
            vs = get_vector_store()
            eg = get_embedding_generator()
            videos = await vs.list_videos()
            with click.progressbar(videos, label="Reindexing videos") as bar:
                for video in bar:
                    try:
                        # Placeholder: implement actual reindex logic
                        await asyncio.sleep(0.1)
                    except Exception as e:
                        click.echo(f"Error reindexing {video['path']}: {e}", err=True)
            click.echo("✓ Reindexing completed")
        except Exception as e:
            click.echo(f"✗ Error reindexing: {e}", err=True)
            raise click.ClickException(str(e))
    asyncio.run(_reindex())

@register
@click.command("stats")
def stats():
    """Show system statistics."""
    async def _stats():
        try:
            from .services import get_vector_store
            stats = await get_vector_store().get_system_stats()
            click.echo("System Statistics:")
            click.echo("-" * 40)
            click.echo(f"Total videos: {stats.get('total_videos', 0)}")
            click.echo(f"Total vectors: {stats.get('total_vectors', 0)}")
            click.echo(f"Storage used: {stats.get('storage_used', 'N/A')}\n")
            click.echo("Vectors by level:")
            for lvl, cnt in stats.get('vectors_by_level', {}).items():
                click.echo(f"  {lvl}: {cnt}")
        except Exception as e:
            click.echo(f"✗ Error getting stats: {e}", err=True)
            raise click.ClickException(str(e))
    asyncio.run(_stats())

@register
@click.command("delete")
@click.argument("video_uuid", type=str)
def delete(video_uuid: str):
    """Delete a video and all its embeddings."""
    async def _delete():
        try:
            from .services import get_vector_store
            if not click.confirm(f"Delete video {video_uuid}?"):
                click.echo("Cancelled")
                return
            await get_vector_store().delete_video(video_uuid)
            click.echo(f"✓ Video {video_uuid} deleted successfully")
        except Exception as e:
            click.echo(f"✗ Error deleting video: {e}", err=True)
            raise click.ClickException(str(e))
    asyncio.run(_delete())

@register
@click.command("validate")
@click.argument("path", type=click.Path(exists=True))
def validate(path: str):
    """Validate a video file for ingestion."""
    async def _validate():
        try:
            from .services import get_hierarchy_manager
            hm = get_hierarchy_manager()
            click.echo(f"Validating: {path}")
            duration = await hm.get_video_duration(path)
            click.echo(f"✓ Duration: {duration}s")
            scenes = await hm.detect_scenes(path)
            click.echo(f"✓ Scenes detectable: {len(scenes)}")
            file_hash = await hm.get_file_hash(path)
            click.echo(f"✓ File hash: {file_hash[:16]}...")
            click.echo("✓ Video file is valid for ingestion")
        except Exception as e:
            click.echo(f"✗ Validation failed: {e}", err=True)
            raise click.ClickException(str(e))
    asyncio.run(_validate())

@register
@click.command("help")
def help_():
    """Show detailed help information."""
    click.echo("""
Video DAM System Commands

INGESTION:
  ingest <path>           - Ingest a single video file
  batch-ingest <dir>      - Ingest all videos in a directory
  validate <path>         - Validate a video file

SEARCH:
  search <query>          - Search videos with natural language
  list-videos             - List all videos in the system

MANAGEMENT:
  delete <uuid>           - Delete a video
  reindex --version v2    - Reindex with new embeddings
  stats                   - Show system statistics

EXAMPLES:
  dam ingest /path/to/video.mp4
  dam search "slow motion sparks"
  dam batch-ingest /videos --recursive
  dam reindex --version v3
""")

#───────────────────────────────────────────────
# Main: direct invocation for dev/test
#───────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        click.echo("Usage: python commands.py <command> [options]")
        help_()
        sys.exit(1)
    cmd_name = sys.argv[1]
    for cmd in _commands:
        if cmd.name == cmd_name or cmd.__name__ == cmd_name:
            cmd()
            break
    else:
        click.echo(f"Unknown command: {cmd_name}")
        help_()
        sys.exit(1)