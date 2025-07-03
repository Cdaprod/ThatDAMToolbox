# video/scanner.py
"""File scanning and indexing module - pure stdlib"""
from . import config        # <- Give access to video/config.py

import hashlib
import mimetypes
import logging
import os
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Generator, Optional, Set, Dict, Any
from weakref import WeakValueDictionary

# Try to import media detection modules (stdlib only)
try:
    import imghdr
    import wave
    import aifc
    try:
        import sndhdr
    except ImportError:
        sndhdr = None  # Not available in Python 3.13+
except ImportError:
    imghdr = wave = aifc = sndhdr = None

log = logging.getLogger("video.scanner")

import os
from pathlib import Path
import logging
from typing import Generator

log = logging.getLogger("video.scanner")

def safe_iter_files(root: Path) -> Generator[Path, None, None]:
    """
    Recursively yield all files under `root`, but:
     • Skip unreadable dirs (PermissionError)
     • Ignore common trash folders
    """
    SKIP_DIRS = {"$RECYCLE.BIN", "System Volume Information", ".Trash-1000"}
    stack = [root]

    while stack:
        current = stack.pop()
        try:
            # Use os.scandir for finer-grained control
            with os.scandir(current) as it:
                for entry in it:
                    name = entry.name
                    if name in SKIP_DIRS:
                        continue

                    # Is it a directory?
                    try:
                        if entry.is_dir(follow_symlinks=False):
                            stack.append(Path(entry.path))
                            continue
                    except PermissionError:
                        log.warning("🔒 cannot access dir: %s", entry.path)
                        continue

                    # Is it a file?
                    try:
                        if entry.is_file(follow_symlinks=False):
                            yield Path(entry.path)
                    except PermissionError:
                        log.warning("🔒 cannot access file: %s", entry.path)
                        continue

        except PermissionError:
            log.warning("🔒 cannot scan directory: %s", current)
            continue
            
            
class Scanner:
    """File scanner for media indexing"""
    
    # Supported extensions
    VIDEO_EXTS = {'.mp4', '.mov', '.mkv', '.avi', '.wmv', '.flv', '.webm', '.m4v'}
    IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.heic'}
    AUDIO_EXTS = {'.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.wma'}
    
    def __init__(self, db, root_path: Optional[Path] = None):
        self.db = db

        # ── resolve scan-root in a single line ──────────────────────────
        self.root_path: Path = (
            Path(root_path)                               if root_path else
            Path(os.getenv("VIDEO_ROOT", ""))             if os.getenv("VIDEO_ROOT") else
            config.get_path("paths", "root")              or
            Path.home() / "video_root"
        ) / "_INCOMING"
        # ────────────────────────────────────────────────────────────────

        self.cache: WeakValueDictionary = WeakValueDictionary()
        self.logger = logging.getLogger("media_scanner")
        if not self.logger.handlers:
            h = logging.StreamHandler()
            h.setFormatter(logging.Formatter('%(levelname)s: %(message)s'))
            self.logger.addHandler(h)
            self.logger.setLevel(logging.INFO)
                
    def is_media_file(self, path: Path) -> bool:
        """Check if file is a supported media type"""
        ext = path.suffix.lower()
        return ext in (self.VIDEO_EXTS | self.IMAGE_EXTS | self.AUDIO_EXTS)
    
    def quick_hash(self, path: Path, block_size: int = 1024 * 1024) -> str:
        """Compute quick hash using first and last blocks (like your video_cache.py)"""
        try:
            h = hashlib.sha1()
            with path.open("rb") as f:
                # Read first block
                head = f.read(block_size)
                if len(head) < block_size:
                    # Small file, hash entirely
                    h.update(head)
                    return h.hexdigest()
                
                # Read last block
                f.seek(-block_size, os.SEEK_END)
                tail = f.read(block_size)
                
                h.update(head)
                h.update(tail)
                
            return h.hexdigest()
        except (OSError, IOError) as e:
            self.logger.warning(f"Could not hash {path}: {e}")
            return hashlib.sha1(str(path).encode()).hexdigest()  # Fallback
    
    def full_hash(self, path: Path) -> str:
        """Compute full SHA1 hash of file"""
        try:
            h = hashlib.sha1()
            with path.open("rb") as f:
                while chunk := f.read(8192):
                    h.update(chunk)
            return h.hexdigest()
        except (OSError, IOError) as e:
            self.logger.warning(f"Could not hash {path}: {e}")
            return hashlib.sha1(str(path).encode()).hexdigest()  # Fallback
    
    def detect_image_dimensions(self, path: Path) -> tuple[Optional[int], Optional[int]]:
        """Detect image dimensions using stdlib only"""
        if not imghdr:
            return None, None
            
        try:
            img_type = imghdr.what(path)
            if not img_type:
                return None, None
            
            # Basic dimension detection for common formats
            with path.open('rb') as f:
                if img_type == 'jpeg':
                    return self._jpeg_dimensions(f)
                elif img_type == 'png':
                    return self._png_dimensions(f)
                elif img_type == 'gif':
                    return self._gif_dimensions(f)
        except Exception as e:
            self.logger.debug(f"Could not get dimensions for {path}: {e}")
        
        return None, None
    
    def _jpeg_dimensions(self, f):
        """Extract JPEG dimensions"""
        f.seek(0)
        if f.read(2) != b'\xff\xd8':
            return None, None
        
        while True:
            marker = f.read(2)
            if not marker or marker[0] != 0xff:
                break
            
            if marker[1] in (0xc0, 0xc1, 0xc2):  # SOF markers
                f.read(3)  # Skip length and precision
                height = int.from_bytes(f.read(2), 'big')
                width = int.from_bytes(f.read(2), 'big')
                return width, height
            
            # Skip segment
            length = int.from_bytes(f.read(2), 'big')
            f.seek(length - 2, 1)
        
        return None, None
    
    def _png_dimensions(self, f):
        """Extract PNG dimensions"""
        f.seek(0)
        if f.read(8) != b'\x89PNG\r\n\x1a\n':
            return None, None
        
        # Read IHDR chunk
        f.read(4)  # Chunk length
        if f.read(4) != b'IHDR':
            return None, None
        
        width = int.from_bytes(f.read(4), 'big')
        height = int.from_bytes(f.read(4), 'big')
        return width, height
    
    def _gif_dimensions(self, f):
        """Extract GIF dimensions"""
        f.seek(0)
        header = f.read(6)
        if header not in (b'GIF87a', b'GIF89a'):
            return None, None
        
        width = int.from_bytes(f.read(2), 'little')
        height = int.from_bytes(f.read(2), 'little')
        return width, height
    
    def analyze_file(self, path: Path, use_full_hash: bool = False) -> Dict[str, Any]:
        """Analyze a single file and return metadata"""
        try:
            stat = path.stat()
            
            # Use full hash or quick hash
            file_hash = self.full_hash(path) if use_full_hash else self.quick_hash(path)
            
            # Guess MIME type
            mime_type, _ = mimetypes.guess_type(path.name)
            if not mime_type:
                ext = path.suffix.lower()
                if ext in self.VIDEO_EXTS:
                    mime_type = f"video/{ext[1:]}"
                elif ext in self.IMAGE_EXTS:
                    mime_type = f"image/{ext[1:]}"
                elif ext in self.AUDIO_EXTS:
                    mime_type = f"audio/{ext[1:]}"
                else:
                    mime_type = "application/octet-stream"
            
            # Get dimensions for images
            width, height = None, None
            if mime_type and mime_type.startswith('image/'):
                width, height = self.detect_image_dimensions(path)
            
            # Determine batch from parent directory
            batch = path.parent.name if path.parent.name != "_INCOMING" else None
            
            return {
                'id': file_hash,
                'path': path.as_posix(),
                'size_bytes': stat.st_size,
                'mtime': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                'mime': mime_type,
                'width_px': width,
                'height_px': height,
                'duration_s': None,  # Would need ffprobe for video duration
                'batch': batch,
                'sha1': file_hash,  # For compatibility with existing sync code
                'created_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error analyzing {path}: {e}")
            return None
    
    def process_file(self, path: Path) -> bool:
        """Process a single file"""
        if not path.is_file() or not self.is_media_file(path):
            return False
        
        # Check if file changed since last scan
        existing = self.db.get_file_by_path(path.as_posix())
        if existing:
            stat = path.stat()
            existing_mtime = datetime.fromisoformat(existing['mtime']).timestamp()
            if (abs(existing_mtime - stat.st_mtime) < 1 and 
                existing['size_bytes'] == stat.st_size):
                # File unchanged
                return False
        
        # Analyze file
        metadata = self.analyze_file(path)
        if metadata:
            self.db.upsert_file(metadata)
            self.cache[metadata['id']] = metadata
            self.logger.info(f"Indexed: {path.name}")
            return True
        
        return False
    
    def scan_directory(self, directory: Path) -> int:
        """Scan a single directory"""
        if not directory.exists() or not directory.is_dir():
            self.logger.warning(f"Directory does not exist: {directory}")
            return 0
        
        processed = 0
        try:
            for path in safe_iter_files(directory):
                if self.process_file(path):
                    processed += 1
        except Exception as e:
            self.logger.error(f"Error scanning {directory}: {e}")
        
        return processed
    
    def bulk_scan(self, root_path: Optional[Path] = None, workers: int = 4) -> Dict[str, int]:
        """Scan files in parallel"""
        scan_root = root_path or self.root_path

        if not scan_root.exists():
            self.logger.warning(f"Scan root does not exist: {scan_root}")
            return {'processed': 0, 'errors': 0}

        self.logger.info(f"Starting scan of {scan_root}")

        # ─── collect files safely ────────────────────────────────────────
        all_files = [p for p in safe_iter_files(scan_root)
                     if self.is_media_file(p)]
        self.logger.info("Queued %d files for processing", len(all_files))

        processed = 0
        errors = 0

        # ─── process in parallel ─────────────────────────────────────────
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_path = {
                executor.submit(self.process_file, path): path
                for path in all_files
            }

            for future in as_completed(future_to_path):
                path = future_to_path[future]
                try:
                    if future.result():
                        processed += 1
                except Exception as e:
                    self.logger.error(f"Error processing {path}: {e}")
                    errors += 1

        self.logger.info(f"Scan complete: {processed} processed, {errors} errors")
        return {
            'processed': processed,
            'errors': errors,
            'total_files': len(all_files),
        }