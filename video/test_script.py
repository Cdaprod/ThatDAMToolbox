#!/usr/bin/env python3
"""
Safe test script - just shows what would be indexed without changing anything
Place this in your video/ directory as test.py
"""

from pathlib import Path
import logging

# Configure logging to see what's happening
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def safe_preview(test_dir=None):
    """Preview what would be indexed without creating database"""
    from video import MediaIndexer
    
    # Use a temporary database path for testing
    test_db = Path.home() / "test_media_index.sqlite3"
    
    # Create indexer with test database
    indexer = MediaIndexer(db_path=test_db, root_path=test_dir)
    
    print(f"Database will be created at: {test_db}")
    print(f"Scanning directory: {indexer.scanner.root_path}")
    print(f"Directory exists: {indexer.scanner.root_path.exists()}")
    
    if not indexer.scanner.root_path.exists():
        print("Creating test directory structure...")
        indexer.scanner.root_path.mkdir(parents=True, exist_ok=True)
        print("Add some media files to this directory and run again")
        return
    
    # Just scan and show what would be processed
    print("\nSupported file types:")
    print(f"Video: {', '.join(indexer.scanner.VIDEO_EXTS)}")
    print(f"Image: {', '.join(indexer.scanner.IMAGE_EXTS)}")
    print(f"Audio: {', '.join(indexer.scanner.AUDIO_EXTS)}")
    
    # Count files that would be processed
    media_files = []
    for path in indexer.scanner.root_path.rglob("*"):
        if path.is_file() and indexer.scanner.is_media_file(path):
            media_files.append(path)
    
    print(f"\nFound {len(media_files)} media files:")
    for i, path in enumerate(media_files[:10]):  # Show first 10
        print(f"  {i+1}. {path.name} ({path.stat().st_size:,} bytes)")
    
    if len(media_files) > 10:
        print(f"  ... and {len(media_files) - 10} more")
    
    # Ask before proceeding
    if media_files:
        response = input(f"\nProceed with indexing {len(media_files)} files? (y/N): ")
        if response.lower() == 'y':
            result = indexer.scan()
            print(f"\nIndexing complete!")
            print(f"Processed: {result['processed']}")
            print(f"Errors: {result['errors']}")
            
            # Show some results
            recent = indexer.get_recent(5)
            print(f"\nRecent files:")
            for file in recent:
                print(f"  {Path(file['path']).name} - {file['mime']} ({file['size_bytes']:,} bytes)")
            
            # Show stats
            stats = indexer.get_stats()
            print(f"\nDatabase stats:")
            print(f"Total files: {stats['total_files']}")
            print(f"Total size: {stats['total_size_bytes']:,} bytes")
            
            print(f"\nDatabase saved to: {test_db}")
            print("You can safely delete this test database anytime")
    else:
        print("\nNo media files found to index")

if __name__ == "__main__":
    import sys
    test_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    safe_preview(test_dir)