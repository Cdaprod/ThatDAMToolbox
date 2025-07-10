# app/core/factory.py
from __future__ import annotations
import os
import json
import uuid
import base64
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from video.core.artifacts.video import VideoArtifact
from video.core.artifacts.batch import BatchArtifact

class ArtifactFactory:
    """Factory for creating VideoArtifact and BatchArtifact from various sources"""
    
    @staticmethod
    def create_video_from_path(file_path: str) -> VideoArtifact:
        """Create VideoArtifact from a local file path"""
        vid = str(uuid.uuid4())
        filename = Path(file_path).name
        video = VideoArtifact(id=vid, metadata={}, filename=filename, source_type='file')
        video.set_source_data(file_path=file_path)
        video.extract_metadata()
        return video

    @staticmethod
    def create_video_from_upload(filename: str, data: bytes, metadata: Optional[Dict[str, Any]] = None) -> VideoArtifact:
        """Create VideoArtifact from uploaded bytes payload"""
        vid = str(uuid.uuid4())
        video = VideoArtifact(id=vid, metadata=metadata or {}, filename=filename, source_type='upload')
        video.set_source_data(file_data=data)
        video.extract_metadata()
        return video

    @staticmethod
    def create_batch_from_folder(folder: str, batch_name: Optional[str] = None) -> BatchArtifact:
        """Create BatchArtifact by scanning all video files in a directory"""
        bid = str(uuid.uuid4())
        name = batch_name or Path(folder).name or f"batch_{bid[:8]}"
        batch = BatchArtifact(id=bid, metadata={}, name=name)
        # scan common video extensions
        exts = ('.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v')
        for ext in exts:
            for fp in Path(folder).glob(f'*{ext}'):
                video = ArtifactFactory.create_video_from_path(str(fp))
                batch.add_video(video)
        batch.metadata['source_interface'] = {'type': 'folder', 'path': folder}
        return batch

    @staticmethod
    def create_batch_from_cli(args: Any, file_paths: List[str]) -> BatchArtifact:
        """Create BatchArtifact from CLI args and explicit file list"""
        bid = str(uuid.uuid4())
        name = getattr(args, 'batch_name', None) or f"cli_batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        batch = BatchArtifact(id=bid, metadata={}, name=name)
        batch.metadata['source_interface'] = {'type': 'cli', 'args': vars(args)}
        # add each path or recurse directories
        for fp in file_paths:
            p = Path(fp)
            if p.is_file():
                batch.add_video(ArtifactFactory.create_video_from_path(str(p)))
            elif p.is_dir():
                for child in p.rglob('*'):
                    if child.is_file() and ArtifactFactory._is_video_file(str(child)):
                        batch.add_video(ArtifactFactory.create_video_from_path(str(child)))
        # record config
        batch.metadata['config'] = {
            'quality': getattr(args, 'quality', None),
            'format': getattr(args, 'format', None),
            'output': getattr(args, 'output', None)
        }
        return batch

    @staticmethod
    def create_batch_from_api(
        uploads: List[Dict[str, Any]],
        config: Dict[str, Any],
        request_metadata: Optional[Dict[str, Any]] = None
    ) -> BatchArtifact:
        """Create BatchArtifact from API uploads"""
        bid = str(uuid.uuid4())
        name = f"api_batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        batch = BatchArtifact(id=bid, metadata=request_metadata or {}, name=name)
        batch.metadata['source_interface'] = {'type': 'api'}
        for upl in uploads:
            filename = upl.get('filename', 'upload')
            data = upl.get('data', b'')
            vid = ArtifactFactory.create_video_from_upload(filename, data, metadata=upl.get('metadata'))
            batch.add_video(vid)
        batch.metadata['config'] = config
        return batch

    @staticmethod
    def create_batch_from_ios(shortcuts_data: Dict[str, Any]) -> BatchArtifact:
        """Create BatchArtifact from iOS Shortcuts payload"""
        bid = str(uuid.uuid4())
        name = f"ios_batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        batch = BatchArtifact(id=bid, metadata=shortcuts_data.copy(), name=name)
        batch.metadata['source_interface'] = {'type': 'ios_shortcuts'}
        for video_data in shortcuts_data.get('videos', []):
            b64 = video_data.get('data', '')
            data = base64.b64decode(b64)
            filename = video_data.get('filename', 'ios.mov')
            vid = ArtifactFactory.create_video_from_upload(filename, data, metadata=video_data.get('metadata'))
            batch.add_video(vid)
        batch.metadata['config'] = shortcuts_data.get('config', {})
        return batch

    @staticmethod
    def _is_video_file(path: str) -> bool:
        """Simple extension check"""
        return Path(path).suffix.lower() in {'.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm', '.m4v'}
