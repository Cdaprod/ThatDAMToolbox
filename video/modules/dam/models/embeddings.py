## video/dam/models/embeddings.py
"""
Embedding generation for multimodal video content.
Handles visual (OpenCLIP), audio (Whisper+SBERT), and motion (VideoMAE+BaFormer) embeddings.
"""

import asyncio
import logging
import tempfile
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from pathlib import Path

# ML model imports
import torch
import torch.nn.functional as F
from transformers import AutoTokenizer, AutoModel
import whisper
import open_clip
import cv2

from .hierarchy import VideoSlice, HierarchyManager
from video.core.ports import tenant_prefix

logger = logging.getLogger(__name__)

class EmbeddingGenerator:
    """
    Generates multimodal embeddings for video content at all hierarchy levels.
    
    Models used:
    - Visual: OpenCLIP ViT-L/14 (1024-D)
    - Audio: Whisper + Sentence-BERT (768-D)
    - Motion: VideoMAE + BaFormer (768-D + 200-D)
    """
    
    def __init__(self, device: str = "cuda" if torch.cuda.is_available() else "cpu"):
        self.device = device
        self.hierarchy_manager = HierarchyManager()
        
        # Model instances (lazy loaded)
        self._clip_model = None
        self._clip_preprocess = None
        self._whisper_model = None
        self._sbert_model = None
        self._sbert_tokenizer = None
        self._videomae_model = None
        
        # Cache for embeddings
        self.embedding_cache = {}
        
        # Model versions for cache invalidation
        self.model_versions = {
            "clip": "v1",
            "whisper": "v1",
            "sbert": "v1",
            "videomae": "v1"
        }
    
    async def initialize_models(self):
        """Initialize all ML models."""
        await self._load_clip_model()
        await self._load_whisper_model()
        await self._load_sbert_model()
        await self._load_videomae_model()
    
    async def _load_clip_model(self):
        """Load OpenCLIP model for visual embeddings."""
        if self._clip_model is None:
            def _load():
                model, _, preprocess = open_clip.create_model_and_transforms(
                    'ViT-L-14',
                    pretrained='laion2b_s32b_b82k',
                    device=self.device
                )
                return model, preprocess
            
            self._clip_model, self._clip_preprocess = await asyncio.get_event_loop().run_in_executor(
                None, _load
            )
            logger.info("OpenCLIP model loaded")
    
    async def _load_whisper_model(self):
        """Load Whisper model for audio transcription."""
        if self._whisper_model is None:
            def _load():
                return whisper.load_model("small", device=self.device)
            
            self._whisper_model = await asyncio.get_event_loop().run_in_executor(
                None, _load
            )
            logger.info("Whisper model loaded")
    
    async def _load_sbert_model(self):
        """Load Sentence-BERT model for text embeddings."""
        if self._sbert_model is None:
            def _load():
                tokenizer = AutoTokenizer.from_pretrained('sentence-transformers/all-mpnet-base-v2')
                model = AutoModel.from_pretrained('sentence-transformers/all-mpnet-base-v2')
                model.to(self.device)
                return model, tokenizer
            
            self._sbert_model, self._sbert_tokenizer = await asyncio.get_event_loop().run_in_executor(
                None, _load
            )
            logger.info("Sentence-BERT model loaded")
    
    async def _load_videomae_model(self):
        """Load VideoMAE model for motion embeddings."""
        if self._videomae_model is None:
            def _load():
                # Placeholder for VideoMAE model loading
                # In practice, you would load the actual VideoMAE model here
                logger.info("VideoMAE model loaded (placeholder)")
                return None
            
            self._videomae_model = await asyncio.get_event_loop().run_in_executor(
                None, _load
            )
    
    async def generate_visual_embedding(self, frame: np.ndarray) -> np.ndarray:
        """Generate visual embedding for a single frame using OpenCLIP."""
        await self._load_clip_model()
        
        def _generate():
            # Preprocess frame
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame_pil = self._clip_preprocess(frame_rgb).unsqueeze(0).to(self.device)
            
            # Generate embedding
            with torch.no_grad():
                embedding = self._clip_model.encode_image(frame_pil)
                embedding = F.normalize(embedding, dim=-1)
            
            return embedding.cpu().numpy().flatten()
        
        return await asyncio.get_event_loop().run_in_executor(None, _generate)
    
    async def generate_audio_embedding(self, audio_path: str) -> np.ndarray:
        """Generate audio embedding using Whisper + Sentence-BERT."""
        await self._load_whisper_model()
        await self._load_sbert_model()
        
        def _generate():
            # Transcribe audio
            result = self._whisper_model.transcribe(audio_path)
            text = result["text"]
            
            if not text.strip():
                # Return zero embedding for silent audio
                return np.zeros(768)
            
            # Generate text embedding
            inputs = self._sbert_tokenizer(
                text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self._sbert_model(**inputs)
                embedding = outputs.last_hidden_state.mean(dim=1)
                embedding = F.normalize(embedding, dim=-1)
            
            return embedding.cpu().numpy().flatten()
        
        return await asyncio.get_event_loop().run_in_executor(None, _generate)
    
    async def generate_motion_embedding(self, path: str, start_time: float, end_time: float) -> np.ndarray:
        """Generate motion embedding using VideoMAE + BaFormer."""
        await self._load_videomae_model()
        
        def _generate():
            # Placeholder for motion embedding generation
            # In practice, this would:
            # 1. Extract video segment
            # 2. Run through VideoMAE for temporal features
            # 3. Run through BaFormer for action classification
            # 4. Concatenate features
            
            # For now, return random embedding
            videomae_features = np.random.normal(0, 1, 768)
            baformer_features = np.random.normal(0, 1, 200)
            
            motion_embedding = np.concatenate([videomae_features, baformer_features])
            return motion_embedding / np.linalg.norm(motion_embedding)
        
        return await asyncio.get_event_loop().run_in_executor(None, _generate)
    
    async def generate_multimodal_embedding(self, path: str, slice_obj: VideoSlice) -> np.ndarray:
        """Generate fused multimodal embedding for a video slice."""
        embeddings = []
        
        # Visual embedding
        if slice_obj.level == "L3":
            # For keyframes, use single frame
            frame = await self.hierarchy_manager.extract_frame(path, slice_obj.start_time)
            if frame is not None:
                visual_emb = await self.generate_visual_embedding(frame)
                embeddings.append(visual_emb)
        else:
            # For other levels, use middle frame
            mid_time = (slice_obj.start_time + slice_obj.end_time) / 2
            frame = await self.hierarchy_manager.extract_frame(path, mid_time)
            if frame is not None:
                visual_emb = await self.generate_visual_embedding(frame)
                embeddings.append(visual_emb)
        
        # Audio embedding
        if slice_obj.duration > 0.5:  # Only for segments longer than 0.5s
            audio_path = await self.hierarchy_manager.extract_audio_segment(
                path, slice_obj.start_time, slice_obj.end_time
            )
            if audio_path:
                audio_emb = await self.generate_audio_embedding(audio_path)
                embeddings.append(audio_emb)
                
                # Clean up temporary audio file
                Path(audio_path).unlink(missing_ok=True)
        
        # Motion embedding
        if slice_obj.level in ["L1", "L2"]:  # Only for scenes and beats
            motion_emb = await self.generate_motion_embedding(
                path, slice_obj.start_time, slice_obj.end_time
            )
            embeddings.append(motion_emb)
        
        # Fuse embeddings
        if embeddings:
            # Concatenate all embeddings
            fused_embedding = np.concatenate(embeddings)
            
            # L2 normalize
            fused_embedding = fused_embedding / np.linalg.norm(fused_embedding)
            
            # Optional PCA compression based on target dimensions
            target_dims = self.hierarchy_manager.level_configs[slice_obj.level]["target_dims"]
            if len(fused_embedding) > target_dims:
                # Placeholder for PCA compression
                # In practice, you would use sklearn.decomposition.PCA
                fused_embedding = fused_embedding[:target_dims]
            
            return fused_embedding
        else:
            # Return zero embedding if no modalities available
            target_dims = self.hierarchy_manager.level_configs[slice_obj.level]["target_dims"]
            return np.zeros(target_dims)
    
    async def generate_video_vector(self, path: str) -> np.ndarray:
        """Generate L0 (whole video) embedding."""
        # Create L0 slice
        duration = await self.hierarchy_manager.get_video_duration(path)
        l0_slice = VideoSlice(0.0, duration, "L0", {"type": "whole_video"})
        
        return await self.generate_multimodal_embedding(path, l0_slice)
    
    async def generate_text_vector(self, text: str) -> np.ndarray:
        """Generate embedding for text query."""
        await self._load_sbert_model()
        
        def _generate():
            inputs = self._sbert_tokenizer(
                text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=512
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self._sbert_model(**inputs)
                embedding = outputs.last_hidden_state.mean(dim=1)
                embedding = F.normalize(embedding, dim=-1)
            
            return embedding.cpu().numpy().flatten()
        
        return await asyncio.get_event_loop().run_in_executor(None, _generate)
    
    async def generate_level_vectors(self, path: str, scenes: List[VideoSlice], level: str) -> List[Dict[str, Any]]:
        """Generate embeddings for all slices at a specific level."""
        if level == "L1":
            slices = scenes
        elif level == "L2":
            slices = await self.hierarchy_manager.generate_beats(path, scenes)
        elif level == "L3":
            beats = await self.hierarchy_manager.generate_beats(path, scenes)
            slices = await self.hierarchy_manager.generate_keyframes(path, beats)
        else:
            raise ValueError(f"Invalid level: {level}")
        
        vectors = []
        for slice_obj in slices:
            try:
                embedding = await self.generate_multimodal_embedding(path, slice_obj)
                
                vectors.append({
                    "slice": slice_obj,
                    "embedding": embedding,
                    "level": level,
                    "start_time": slice_obj.start_time,
                    "end_time": slice_obj.end_time,
                    "metadata": slice_obj.metadata
                })
            except Exception as e:
                logger.error(f"Error generating embedding for slice {slice_obj.cache_key}: {e}")
                continue
        
        return vectors
    
    def get_cache_key(self, path: str, slice_obj: VideoSlice, tenant_id: str = "default") -> str:
        """Generate cache key for embedding."""
        file_hash = hash(path)  # Simplified hash
        key = f"{file_hash}_{slice_obj.cache_key}_{slice_obj.level}"
        return tenant_prefix(tenant_id, key)

    async def get_cached_embedding(self, path: str, slice_obj: VideoSlice, tenant_id: str = "default") -> Optional[np.ndarray]:
        """Get cached embedding if available."""
        cache_key = self.get_cache_key(path, slice_obj, tenant_id)
        return self.embedding_cache.get(cache_key)

    async def cache_embedding(self, path: str, slice_obj: VideoSlice, embedding: np.ndarray, tenant_id: str = "default"):
        """Cache embedding for future use."""
        cache_key = self.get_cache_key(path, slice_obj, tenant_id)
        self.embedding_cache[cache_key] = embedding