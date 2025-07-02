# video/sync.py
"""Photo sync integration - compatible with your existing photo sync scripts"""

import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, Any

class PhotoSync:
    """Photo sync integration for iOS Photos app"""
    
    # From your existing script
    PHOTOS_ROOTS = {
        "edit": "Cdaprod Asset/Edit Ready Videos (Pre-Production Ready)/By Topic - Screen Record Albums",
        "digital": "Cdaprod Asset/Digital Assets (Post-Production Ready)"
    }
    
    SMB_INCOMING = "_INCOMING"
    
    def __init__(self, db, root_dir: Optional[Path] = None):
        self.db = db
        self.root_dir = root_dir or (Path.home() / "video_root")
        self.logger = logging.getLogger("photo_sync")
        
        # Configure logging if needed
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter('%(levelname)s: %(message)s'))
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    def sha1_of_data(self, data: bytes) -> str:
        """Compute SHA1 of binary data"""
        return hashlib.sha1(data).hexdigest()
    
    def sync_album_from_args(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sync album using arguments from Shortcuts (compatible with your script)
        
        Args:
            args: Dict with keys:
                - root: SMB root path
                - album: album name (optional, will prompt if missing)
                - category: "edit" or "digital" (default "edit")
        """
        try:
            # Import photos module (iOS only)
            import photos
            import console
        except ImportError:
            self.logger.error("Photos module not available - iOS only feature")
            return {"error": "Photos module not available"}
        
        root_dir = Path(args.get("root", self.root_dir))
        category = args.get("category", "edit").lower()
        album_leaf = args.get("album")
        
        # Validate category
        base_title = self.PHOTOS_ROOTS.get(category)
        if not base_title:
            error_msg = f"Unknown category {category!r}"
            console.alert("Error", error_msg, "OK")
            return {"error": error_msg}
        
        # Build list of albums
        try:
            all_albums = photos.get_albums()
            candidates = [a for a in all_albums if a.title.startswith(base_title)]
            leaf_to_album = {
                a.title.split("/", maxsplit=len(base_title.split("/")))[-1]: a
                for a in candidates
            }
        except Exception as e:
            error_msg = f"Failed to get albums: {e}"
            self.logger.error(error_msg)
            return {"error": error_msg}
        
        if not leaf_to_album:
            error_msg = f"No albums found under {base_title}"
            console.alert("No albums", error_msg, "OK")
            return {"error": error_msg}
        
        # Select album
        if not album_leaf:
            album_leaf = console.pick_item(
                sorted(leaf_to_album), 
                title="Pick Album"
            )
            if album_leaf is None:
                return {"cancelled": True}
        
        album = leaf_to_album.get(album_leaf)
        if not album:
            error_msg = f"No album called {album_leaf!r}"
            console.alert("Error", error_msg, "OK")
            return {"error": error_msg}
        
        # Set up destination
        dest_dir = root_dir / self.SMB_INCOMING / album_leaf
        dest_dir.mkdir(parents=True, exist_ok=True)
        
        # Sync files
        return self._sync_photos_album(album, dest_dir, album_leaf)
    
    def _sync_photos_album(self, album, dest_dir: Path, album_name: str) -> Dict[str, Any]:
        """Internal method to sync a Photos album"""
        try:
            import photos
        except ImportError:
            return {"error": "Photos module not available"}
        
        assets = photos.get_assets(album=album, include_videos=True)
        synced = skipped = 0
        
        for asset in assets:
            # Get asset data
            if asset.media_type == photos.MEDIA_TYPE_IMAGE:
                data = asset.get_image_data()
                ext = "jpg"
            else:
                data = asset.get_video_data()
                ext = "mov"
            
            # Compute hash
            sha1 = self.sha1_of_data(data)
            
            # Check if already copied
            if self.db.already_copied(sha1):
                skipped += 1
                continue
            
            # Generate filename
            ts = asset.creation_date.strftime("%Y%m%d_%H%M%S")
            fname = f"{ts}_{synced:04d}.{ext}"
            out_path = dest_dir / fname
            
            # Write file
            try:
                with open(out_path, "wb") as fp:
                    fp.write(data)
                
                # Remember in sync table
                self.db.remember_copy(sha1, out_path)
                
                # Index in main database
                metadata = {
                    'id': sha1,
                    'path': out_path.as_posix(),
                    'size_bytes': len(data),
                    'mtime': asset.creation_date.isoformat(),
                    'mime': f"image/{ext}" if ext == "jpg" else f"video/{ext}",
                    'width_px': None,
                    'height_px': None,
                    'duration_s': None,
                    'batch': album_name,
                    'sha1': sha1,
                    'created_at': datetime.now().isoformat()
                }
                self.db.upsert_file(metadata)
                
                synced += 1
                self.logger.info(f"Synced: {fname}")
                
            except Exception as e:
                self.logger.error(f"Failed to write {out_path}: {e}")
                continue
        
        result = {
            "category": album.title.split("/")[0] if "/" in album.title else "unknown",
            "album": album_name,
            "synced": synced,
            "skipped": skipped,
            "dest": str(dest_dir)
        }
        
        self.logger.info(f"Sync complete: {synced} new, {skipped} skipped")
        return result
    
    def sync_from_shortcuts(self, stdin_json: str = None) -> str:
        """
        Main entry point for Shortcuts integration
        Returns JSON string compatible with your existing script
        """
        try:
            if stdin_json:
                args = json.loads(stdin_json)
            else:
                import sys
                args = json.loads(sys.stdin.read() or "{}")
            
            result = self.sync_album_from_args(args)
            
            # Show alert if available
            try:
                import console
                if "error" in result:
                    console.alert("Sync Error", result["error"], "OK")
                elif "cancelled" in result:
                    pass  # User cancelled
                else:
                    console.alert(
                        "Sync finished",
                        f"{result['synced']} new / {result['skipped']} skipped\n→ {result['dest']}",
                        "OK"
                    )
            except ImportError:
                pass
            
            return json.dumps(result, ensure_ascii=False)
            
        except Exception as e:
            error_result = {"error": str(e)}
            self.logger.error(f"Sync failed: {e}")
            return json.dumps(error_result)
    
    def get_synced_albums(self) -> list:
        """Get list of albums that have been synced"""
        with self.db.conn() as cx:
            result = cx.execute("""
                SELECT batch, COUNT(*) as file_count, 
                       MIN(created_at) as first_sync,
                       MAX(created_at) as last_sync
                FROM files 
                WHERE batch IS NOT NULL 
                GROUP BY batch 
                ORDER BY last_sync DESC
            """).fetchall()
            return [dict(row) for row in result]
    
    def cleanup_orphaned_copies(self) -> int:
        """Remove copy records for files that no longer exist"""
        removed = 0
        with self.db.conn() as cx:
            copies = cx.execute("SELECT sha1, dest FROM copies").fetchall()
            for row in copies:
                if not Path(row['dest']).exists():
                    cx.execute("DELETE FROM copies WHERE sha1 = ?", (row['sha1'],))
                    removed += 1
        
        self.logger.info(f"Cleaned up {removed} orphaned copy records")
        return removed


# Standalone script compatibility
if __name__ == "__main__":
    import sys
    from .db import MediaDB
    
    # This allows the module to be run as a standalone script
    # Compatible with your existing workflow
    db = MediaDB()
    sync = PhotoSync(db)
    
    result_json = sync.sync_from_shortcuts()
    print(result_json)