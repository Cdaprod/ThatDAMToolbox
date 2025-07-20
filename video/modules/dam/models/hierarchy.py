## video/dam/models/hierarchy.py
"""
Hierarchy management for the four-level video structure.
Handles scene detection, time-based slicing, and metadata management.
"""

import asyncio
import hashlib
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import subprocess
import tempfile

import cv2
import numpy as np
from scenedetect import detect, ContentDetector
from scenedetect.video_splitter import split_video_ffmpeg

logger = logging.getLogger(__name__)

class VideoSlice:
    """Represents a time-based slice of video content."""
    
    def __init__(self, start_time: float, end_time: float, level: str, metadata: Dict = None):
        self.start_time = start_time
        self.end_time = end_time
        self.level = level
        self.metadata = metadata or {}
        self.duration = end_time - start_time
        self.cache_key = self._generate_cache_key()
    
    def _generate_cache_key(self) -> str:
        """Generate cache key for this slice."""
        key_data = f"{self.start_time}:{self.end_time}:{self.level}"
        return hashlib.sha256(key_data.encode()).hexdigest()[:16]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert slice to dictionary."""
        return {
            "start_time": self.start_time,
            "end_time": self.end_time,
            "level": self.level,
            "duration": self.duration,
            "metadata": self.metadata,
            "cache_key": self.cache_key
        }

class HierarchyManager:
    """
    Manages the four-level hierarchy of video content.
    
    Level hierarchy:
    - L0: Whole video (768-1024 dims)
    - L1: Scene/shot (1024-1536 dims)
    - L2: Beat/action-block (1024-2048 dims)
    - L3: Key-frame thumbnail (512-768 dims)
    """
    
    def __init__(self, cache_dir: str = "./cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Scene detection settings
        self.scene_detector = ContentDetector(threshold=27.0)
        
        # Level configurations
        self.level_configs = {
            "L0": {"type": "whole_video", "target_dims": 768},
            "L1": {"type": "scene", "target_dims": 1024},
            "L2": {"type": "beat", "target_dims": 1536},
            "L3": {"type": "keyframe", "target_dims": 512}
        }
    
    async def get_file_hash(self, path: str) -> str:
        """Generate SHA256 hash of video file for caching."""
        def _hash_file():
            hash_sha256 = hashlib.sha256()
            with open(path, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest()
        
        return await asyncio.get_event_loop().run_in_executor(None, _hash_file)
    
    async def get_video_info(self, path: str) -> Optional[Dict[str, Any]]:
        """Get comprehensive video information."""
        if not Path(path).exists():
            return None
        
        try:
            duration = await self.get_video_duration(path)
            file_hash = await self.get_file_hash(path)
            
            # Get video properties
            def _get_props():
                cap = cv2.VideoCapture(path)
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                fps = cap.get(cv2.CAP_PROP_FPS)
                cap.release()
                return width, height, fps
            
            width, height, fps = await asyncio.get_event_loop().run_in_executor(None, _get_props)
            
            return {
                "path": path,
                "duration": duration,
                "file_hash": file_hash,
                "width": width,
                "height": height,
                "fps": fps,
                "file_size": Path(path).stat().st_size
            }
        except Exception as e:
            logger.error(f"Error getting video info for {path}: {e}")
            return None
    
    async def detect_scenes(self, path: str) -> List[VideoSlice]:
        """
        Detect scenes using PySceneDetect content-aware mode.
        Returns L1 level slices (scenes).
        """
        def _detect_scenes():
            try:
                # Use PySceneDetect to find scene boundaries
                scene_list = detect(path, self.scene_detector)
                
                slices = []
                for i, (start_time, end_time) in enumerate(scene_list):
                    slice_obj = VideoSlice(
                        start_time=start_time.get_seconds(),
                        end_time=end_time.get_seconds(),
                        level="L1",
                        metadata={"scene_index": i}
                    )
                    slices.append(slice_obj)
                
                return slices
            except Exception as e:
                logger.error(f"Error detecting scenes: {e}")
                # Fallback: create single scene for entire video
                return [VideoSlice(0.0, 0.0, "L1", {"fallback": True})]
        
        return await asyncio.get_event_loop().run_in_executor(None, _detect_scenes)
    
    async def generate_beats(self, path: str, scenes: List[VideoSlice]) -> List[VideoSlice]:
        """
        Generate L2 level beats/action-blocks from scenes.
        Subdivides scenes into smaller temporal units.
        """
        beats = []
        
        for scene in scenes:
            # Split each scene into beats (e.g., 5-second chunks)
            beat_duration = 5.0  # 5 seconds per beat
            current_time = scene.start_time
            beat_index = 0
            
            while current_time < scene.end_time:
                beat_end = min(current_time + beat_duration, scene.end_time)
                
                beat = VideoSlice(
                    start_time=current_time,
                    end_time=beat_end,
                    level="L2",
                    metadata={
                        "parent_scene": scene.metadata.get("scene_index", 0),
                        "beat_index": beat_index
                    }
                )
                beats.append(beat)
                
                current_time = beat_end
                beat_index += 1
        
        return beats
    
    async def generate_keyframes(self, path: str, beats: List[VideoSlice]) -> List[VideoSlice]:
        """
        Generate L3 level key-frames from beats.
        Extracts representative frames from each beat.
        """
        def _extract_keyframes():
            keyframes = []
            
            for beat in beats:
                # Extract middle frame of each beat as keyframe
                keyframe_time = (beat.start_time + beat.end_time) / 2
                
                keyframe = VideoSlice(
                    start_time=keyframe_time,
                    end_time=keyframe_time + 0.033,  # Single frame (~30fps)
                    level="L3",
                    metadata={
                        "parent_beat": beat.metadata.get("beat_index", 0),
                        "parent_scene": beat.metadata.get("parent_scene", 0),
                        "keyframe_time": keyframe_time
                    }
                )
                keyframes.append(keyframe)
            
            return keyframes
        
        return await asyncio.get_event_loop().run_in_executor(None, _extract_keyframes)
    
    async def extract_frame(self, path: str, timestamp: float) -> Optional[np.ndarray]:
        """Extract a single frame at the specified timestamp."""
        def _extract():
            cap = cv2.VideoCapture(path)
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_number = int(timestamp * fps)
            
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            ret, frame = cap.read()
            cap.release()
            
            return frame if ret else None
        
        return await asyncio.get_event_loop().run_in_executor(None, _extract)
    
    async def extract_audio_segment(self, path: str, start_time: float, end_time: float) -> Optional[str]:
        """Extract audio segment and return path to temporary file."""
        def _extract():
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                cmd = [
                    "ffmpeg", "-i", path,
                    "-ss", str(start_time),
                    "-to", str(end_time),
                    "-vn", "-acodec", "pcm_s16le",
                    "-y", tmp.name
                ]
                
                try:
                    subprocess.run(cmd, check=True, capture_output=True)
                    return tmp.name
                except subprocess.CalledProcessError as e:
                    logger.error(f"Error extracting audio: {e}")
                    return None
        
        return await asyncio.get_event_loop().run_in_executor(None, _extract)
    
    async def save_hierarchy_cache(self, path: str, hierarchy: Dict[str, List[VideoSlice]]):
        """Save hierarchy to cache file."""
        file_hash = await self.get_file_hash(path)
        cache_file = self.cache_dir / f"{file_hash}_hierarchy.json"
        
        # Convert slices to serializable format
        cache_data = {}
        for level, slices in hierarchy.items():
            cache_data[level] = [slice_obj.to_dict() for slice_obj in slices]
        
        cache_data["metadata"] = {
            "path": path,
            "generated_at": asyncio.get_event_loop().time(),
            "file_hash": file_hash
        }
        
        def _save():
            with open(cache_file, "w") as f:
                json.dump(cache_data, f, indent=2)
        
        await asyncio.get_event_loop().run_in_executor(None, _save)
    
    async def load_hierarchy_cache(self, path: str) -> Optional[Dict[str, List[VideoSlice]]]:
        """Load hierarchy from cache file."""
        file_hash = await self.get_file_hash(path)
        cache_file = self.cache_dir / f"{file_hash}_hierarchy.json"
        
        if not cache_file.exists():
            return None
        
        def _load():
            with open(cache_file, "r") as f:
                cache_data = json.load(f)
            
            # Reconstruct slices from cache
            hierarchy = {}
            for level, slice_data in cache_data.items():
                if level == "metadata":
                    continue
                
                slices = []
                for data in slice_data:
                    slice_obj = VideoSlice(
                        start_time=data["start_time"],
                        end_time=data["end_time"],
                        level=data["level"],
                        metadata=data["metadata"]
                    )
                    slices.append(slice_obj)
                
                hierarchy[level] = slices
            
            return hierarchy
        
        try:
            return await asyncio.get_event_loop().run_in_executor(None, _load)
        except Exception as e:
            logger.error(f"Error loading hierarchy cache: {e}")
            return None
    
    async def generate_full_hierarchy(self, path: str) -> Dict[str, List[VideoSlice]]:
        """Generate complete four-level hierarchy for a video."""
        # Check cache first
        cached_hierarchy = await self.load_hierarchy_cache(path)
        if cached_hierarchy:
            logger.info(f"Loaded hierarchy from cache: {path}")
            return cached_hierarchy
        
        logger.info(f"Generating hierarchy for: {path}")
        
        # Generate L0 (whole video)
        duration = await self.get_video_duration(path)
        l0_slice = VideoSlice(0.0, duration, "L0", {"type": "whole_video"})
        
        # Generate L1 (scenes)
        scenes = await self.detect_scenes(path)
        
        # Generate L2 (beats)
        beats = await self.generate_beats(path, scenes)
        
        # Generate L3 (keyframes)
        keyframes = await self.generate_keyframes(path, beats)
        
        hierarchy = {
            "L0": [l0_slice],
            "L1": scenes,
            "L2": beats,
            "L3": keyframes
        }
        
        # Cache the hierarchy
        await self.save_hierarchy_cache(path, hierarchy)
        
        logger.info(f"Generated hierarchy: L0={len(hierarchy['L0'])}, L1={len(hierarchy['L1'])}, L2={len(hierarchy['L2'])}, L3={len(hierarchy['L3'])}")
        
        return hierarchy