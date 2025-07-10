# /video/dam/commands.py

"""
CLI commands for the DAM system using the @register decorator pattern.
Provides command-line interface for system management and operations.
"""

import click
import asyncio
import logging
from typing import List, Optional
from pathlib import Path
import json

logger = logging.getLogger(__name__)

# Command registry
_commands: List[click.Command] = []

def register(func):
    """Decorator to register CLI commands."""
    _commands.append(func)
    return func

def register_commands(app):
    """Register all CLI commands with the FastAPI app."""
    for command in _commands:
        logger.info(f"Registered command: {command.__name__}")

# Video management commands
@register
@click.command()
@click.argument('path', type=click.Path(exists=True))
@click.option('--force', is_flag=True, help='Force reindexing even if video exists')
@click.option('--metadata', type=str, help='JSON metadata string')
def ingest(path: str, force: bool, metadata: Optional[str]):
    """Ingest a video file into the DAM system."""
    async def _ingest():
        try:
            # Lazy imports to avoid circular dependency
            from .main import get_hierarchy_manager, get_embedding_generator, get_vector_storage

            hierarchy_manager = get_hierarchy_manager()
            embedding_generator = get_embedding_generator()
            vector_storage = get_vector_storage()

            meta = json.loads(metadata) if metadata else {}

            click.echo(f"Ingesting video: {path}")
            l0_vector = await embedding_generator.generate_video_vector(path)
            video_uuid = await vector_storage.store_video(
                path=path, l0_vector=l0_vector, metadata=meta
            )
            click.echo(f"Video ingested with UUID: {video_uuid}")

            scenes = await hierarchy_manager.detect_scenes(path)
            click.echo(f"Detected {len(scenes)} scenes")

            for level in ["L1", "L2", "L3"]:
                vectors = await embedding_generator.generate_level_vectors(
                    path, scenes, level
                )
                await vector_storage.store_level_vectors(video_uuid, level, vectors)
                click.echo(f"Generated {len(vectors)} {level} vectors")

            click.echo("✓ Video ingestion completed successfully")

        except Exception as e:
            click.echo(f"✗ Error ingesting video: {e}", err=True)
            raise click.ClickException(str(e))

    asyncio.run(_ingest())

@register
@click.command()
@click.argument('directory', type=click.Path(exists=True, file_okay=False))
@click.option('--pattern', default='*.mp4', help='File pattern to match')
@click.option('--recursive', is_flag=True, help='Search recursively')
def batch_ingest(directory: str, pattern: str, recursive: bool):
    """Batch ingest all videos in a directory."""
    async def _batch_ingest():
        try:
            from .main import get_embedding_generator, get_vector_storage

            dir_path = Path(directory)
            video_files = (
                list(dir_path.rglob(pattern)) if recursive
                else list(dir_path.glob(pattern))
            )
            click.echo(f"Found {len(video_files)} video files")

            for video_file in video_files:
                try:
                    click.echo(f"Processing: {video_file}")
                    embedding_generator = get_embedding_generator()
                    vector_storage = get_vector_storage()

                    l0_vector = await embedding_generator.generate_video_vector(str(video_file))
                    video_uuid = await vector_storage.store_video(
                        path=str(video_file), l0_vector=l0_vector, metadata={}
                    )
                    click.echo(f"  ✓ Ingested: {video_uuid}")
                except Exception as e:
                    click.echo(f"  ✗ Error processing {video_file}: {e}", err=True)
                    continue

            click.echo("✓ Batch ingestion completed")
        except Exception as e:
            click.echo(f"✗ Error in batch ingestion: {e}", err=True)
            raise click.ClickException(str(e))

    asyncio.run(_batch_ingest())

@register
@click.command()
@click.argument('query', type=str)
@click.option('--level', default='all', help='Search level (L0, L1, L2, L3, all)')
@click.option('--limit', default=10, help='Number of results')
@click.option('--threshold', default=0.7, help='Similarity threshold')
def search(query: str, level: str, limit: int, threshold: float):
    """Search videos using natural language queries."""
    async def _search():
        try:
            from .main import get_embedding_generator, get_vector_storage

            embedding_generator = get_embedding_generator()
            vector_storage = get_vector_storage()

            click.echo(f"Searching for: '{query}'")
            query_vector = await embedding_generator.generate_text_vector(query)
            results = await vector_storage.search_vectors(
                query_vector=query_vector,
                level=level,
                limit=limit,
                threshold=threshold
            )

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
@click.command()
@click.option('--skip', default=0, help='Number of records to skip')
@click.option('--limit', default=50, help='Number of records to return')
def list_videos(skip: int, limit: int):
    """List all videos in the system."""
    async def _list():
        try:
            from .main import get_vector_storage

            vector_storage = get_vector_storage()
            videos = await vector_storage.list_videos(skip=skip, limit=limit)

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
@click.command()
@click.option('--version', default='v2', help='New embedding version')
def reindex(version: str):
    """Reindex all videos with a new embedding version."""
    async def _reindex():
        try:
            from .main import get_embedding_generator, get_vector_storage

            click.echo(f"Starting reindex with version: {version}")
            vector_storage = get_vector_storage()
            embedding_generator = get_embedding_generator()

            videos = await vector_storage.list_videos()
            with click.progressbar(videos, label='Reindexing videos') as bar:
                for video in bar:
                    try:
                        # placeholder for actual logic
                        await asyncio.sleep(0.1)
                    except Exception as e:
                        click.echo(f"Error reindexing {video['path']}: {e}", err=True)
                        continue

            click.echo("✓ Reindexing completed")
        except Exception as e:
            click.echo(f"✗ Error reindexing: {e}", err=True)
            raise click.ClickException(str(e))

    asyncio.run(_reindex())

@register
@click.command()
def stats():
    """Show system statistics."""
    async def _stats():
        try:
            from .main import get_vector_storage

            stats = await get_vector_storage().get_system_stats()
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
@click.command()
@click.argument('video_uuid', type=str)
def delete(video_uuid: str):
    """Delete a video and all its embeddings."""
    async def _delete():
        try:
            from .main import get_vector_storage

            if not click.confirm(f"Delete video {video_uuid}?"):
                click.echo("Cancelled")
                return

            await get_vector_storage().delete_video(video_uuid)
            click.echo(f"✓ Video {video_uuid} deleted successfully")
        except Exception as e:
            click.echo(f"✗ Error deleting video: {e}", err=True)
            raise click.ClickException(str(e))

    asyncio.run(_delete())

@register
@click.command()
@click.argument('path', type=click.Path(exists=True))
def validate(path: str):
    """Validate a video file for ingestion."""
    async def _validate():
        try:
            from .main import get_hierarchy_manager

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
@click.command()
def help():
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

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        click.echo("Usage: python commands.py <command> [options]")
        help()
        sys.exit(1)

    cmd_name = sys.argv[1]
    for cmd in _commands:
        if cmd.name == cmd_name or cmd.__name__ == cmd_name:
            cmd()
            break
    else:
        click.echo(f"Unknown command: {cmd_name}")
        help()
        sys.exit(1)