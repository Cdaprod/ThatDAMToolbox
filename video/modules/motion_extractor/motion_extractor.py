#!/usr/bin/env python3
"""
/video/modules/motion_extractor/motion_extractor.py

Motion Frame Extractor - Drop-in Module for Python Applications

A self-contained module for extracting frames with motion from video files.
Designed to be easily integrated into any Python application.

Usage:
    from motion_extractor import MotionExtractor
    
    # Simple usage
    extractor = MotionExtractor("input.mp4")
    frames_saved = extractor.extract()
    
    # Advanced usage with custom settings
    extractor = MotionExtractor(
        "input.mp4",
        output_dir="frames",
        motion_threshold=5000,
        fps_sampling=2
    )
    frames_saved = extractor.extract(progress_callback=lambda p: print(f"{p:.1f}%"))

Author: David Cannan
License: MIT
"""

import cv2
import os
import logging
from typing import Optional, Callable, Union
from pathlib import Path


class MotionExtractor:
    """
    A drop-in class for extracting frames with motion from video files.
    
    This class provides a simple interface for motion detection and frame extraction
    from video files, with configurable parameters and optional progress tracking.
    """
    
    def __init__(
        self,
        video_path: Union[str, Path],
        output_dir: Union[str, Path] = "motion_frames",
        motion_threshold: int = 3000,
        fps_sampling: int = 1,
        image_format: str = "jpg",
        skip_frame_duration: float = 2.0,
        create_output_dir: bool = True,
        logger: Optional[logging.Logger] = None
    ):
        """
        Initialize the Motion Extractor.
        
        Args:
            video_path: Path to the input video file
            output_dir: Directory to save extracted frames (default: "motion_frames")
            motion_threshold: Minimum pixel change to consider as motion (default: 3000)
            fps_sampling: Frames per second to sample (default: 1)
            image_format: Output image format - jpg, png, etc. (default: "jpg")
            skip_frame_duration: Seconds of no motion before cutting (default: 2.0)
            create_output_dir: Whether to create output directory if it doesn't exist
            logger: Optional logger instance, will create one if not provided
        
        Raises:
            FileNotFoundError: If video file doesn't exist
            ValueError: If parameters are invalid
        """
        self.video_path = Path(video_path)
        self.output_dir = Path(output_dir)
        self.motion_threshold = motion_threshold
        self.fps_sampling = fps_sampling
        self.image_format = image_format.lower()
        self.skip_frame_duration = skip_frame_duration
        
        # Validation
        if not self.video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")
        
        if motion_threshold <= 0:
            raise ValueError("Motion threshold must be positive")
        
        if fps_sampling <= 0:
            raise ValueError("FPS sampling must be positive")
        
        # Setup output directory
        if create_output_dir:
            self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Setup logging
        self.logger = logger or self._setup_logger()
        
        # Internal state
        self._reset_state()
    
    def _setup_logger(self) -> logging.Logger:
        """Setup a default logger for the extractor."""
        logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        return logger
    
    def _reset_state(self):
        """Reset internal state variables."""
        self.prev_gray = None
        self.saved_count = 0
        self.total_frames_processed = 0
        self.motionless_counter = 0
    
    def _detect_motion(self, frame) -> bool:
        """
        Detect motion in the current frame.
        
        Args:
            frame: Current video frame
            
        Returns:
            True if motion detected, False otherwise
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        if self.prev_gray is None:
            self.prev_gray = gray
            return True  # Always save first frame
        
        diff = cv2.absdiff(self.prev_gray, gray)
        non_zero_count = cv2.countNonZero(diff)
        
        self.prev_gray = gray
        return non_zero_count > self.motion_threshold
    
    def _save_frame(self, frame) -> str:
        """
        Save a frame to disk.
        
        Args:
            frame: Video frame to save
            
        Returns:
            Path to saved file
        """
        filename = f"frame_{self.saved_count:05d}.{self.image_format}"
        filepath = self.output_dir / filename
        
        success = cv2.imwrite(str(filepath), frame)
        if not success:
            raise RuntimeError(f"Failed to save frame: {filepath}")
        
        self.saved_count += 1
        return str(filepath)
    
    def extract(
        self,
        progress_callback: Optional[Callable[[float], None]] = None,
        save_first_frame: bool = True
    ) -> int:
        """
        Extract frames with motion from the video.
        
        Args:
            progress_callback: Optional callback function that receives progress percentage
            save_first_frame: Whether to always save the first frame
            
        Returns:
            Number of frames saved
            
        Raises:
            RuntimeError: If video cannot be opened or processed
        """
        self._reset_state()
        
        cap = cv2.VideoCapture(str(self.video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Failed to open video: {self.video_path}")
        
        try:
            # Get video properties
            fps = int(cap.get(cv2.CAP_PROP_FPS))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            frame_interval = max(1, int(fps / self.fps_sampling))
            
            self.logger.info(f"Processing video: {self.video_path}")
            self.logger.info(f"Video FPS: {fps}, Total frames: {total_frames}")
            self.logger.info(f"Sampling every {frame_interval} frames")
            
            frame_idx = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Skip frames based on sampling rate
                if frame_idx % frame_interval != 0:
                    frame_idx += 1
                    continue
                
                # Process frame
                has_motion = self._detect_motion(frame)
                
                if has_motion or (save_first_frame and self.saved_count == 0):
                    saved_path = self._save_frame(frame)
                    self.logger.debug(f"Saved frame: {saved_path}")
                    self.motionless_counter = 0
                else:
                    self.motionless_counter += 1
                
                self.total_frames_processed += 1
                
                # Progress callback
                if progress_callback and frame_idx % 100 == 0:
                    progress = (frame_idx / total_frames) * 100
                    progress_callback(progress)
                
                frame_idx += 1
            
            # Final progress update
            if progress_callback:
                progress_callback(100.0)
            
            self.logger.info(f"Extraction complete. Saved {self.saved_count} frames.")
            return self.saved_count
            
        finally:
            cap.release()
    
    def extract_with_stats(
        self,
        progress_callback: Optional[Callable[[float], None]] = None
    ) -> dict:
        """
        Extract frames and return detailed statistics.
        
        Args:
            progress_callback: Optional progress callback
            
        Returns:
            Dictionary containing extraction statistics
        """
        frames_saved = self.extract(progress_callback)
        
        return {
            'frames_saved': frames_saved,
            'total_frames_processed': self.total_frames_processed,
            'output_directory': str(self.output_dir),
            'video_path': str(self.video_path),
            'motion_threshold': self.motion_threshold,
            'fps_sampling': self.fps_sampling,
            'success': frames_saved > 0
        }
    
    def get_saved_count(self) -> int:
        """Get the number of frames saved in the last extraction."""
        return self.saved_count
    
    def cleanup(self):
        """Clean up resources and reset state."""
        self._reset_state()
        self.logger.info("Motion extractor cleanup completed")
    
    @staticmethod
    def quick_extract(
        video_path: Union[str, Path],
        output_dir: Union[str, Path] = "motion_frames",
        motion_threshold: int = 3000,
        progress_callback: Optional[Callable[[float], None]] = None
    ) -> int:
        """
        Quick static method for simple extraction without class instantiation.
        
        Args:
            video_path: Path to video file
            output_dir: Output directory for frames
            motion_threshold: Motion detection threshold
            progress_callback: Optional progress callback
            
        Returns:
            Number of frames saved
        """
        extractor = MotionExtractor(
            video_path=video_path,
            output_dir=output_dir,
            motion_threshold=motion_threshold
        )
        return extractor.extract(progress_callback=progress_callback)


# Convenience functions for even easier integration
def extract_motion_frames(
    video_path: str,
    output_dir: str = "motion_frames",
    motion_threshold: int = 3000,
    fps_sampling: int = 1,
    progress_callback: Optional[Callable[[float], None]] = None
) -> int:
    """
    Convenience function to extract motion frames from a video.
    
    Args:
        video_path: Path to the video file
        output_dir: Directory to save frames
        motion_threshold: Minimum pixel change for motion detection
        fps_sampling: Frames per second to sample
        progress_callback: Optional progress callback function
        
    Returns:
        Number of frames saved
    """
    return MotionExtractor.quick_extract(
        video_path=video_path,
        output_dir=output_dir,
        motion_threshold=motion_threshold,
        progress_callback=progress_callback
    )


# Example usage and testing
if __name__ == "__main__":
    import sys
    
    def demo_progress(progress):
        print(f"\rProgress: {progress:.1f}%", end="", flush=True)
    
    # Example 1: Simple usage
    print("=== Motion Extractor Demo ===")
    
    video_file = "input.mp4"  # Change this to your video file
    
    if len(sys.argv) > 1:
        video_file = sys.argv[1]
    
    if not os.path.exists(video_file):
        print(f"Video file '{video_file}' not found. Creating demo...")
        print("Usage: python motion_extractor.py <video_file>")
        sys.exit(1)
    
    try:
        # Method 1: Using the class
        print(f"\n1. Using MotionExtractor class with {video_file}")
        extractor = MotionExtractor(
            video_path=video_file,
            output_dir="demo_frames",
            motion_threshold=3000,
            fps_sampling=1
        )
        
        stats = extractor.extract_with_stats(progress_callback=demo_progress)
        print(f"\nExtraction complete!")
        print(f"Results: {stats}")
        
        # Method 2: Using the convenience function
        print(f"\n2. Using convenience function")
        frames_saved = extract_motion_frames(
            video_path=video_file,
            output_dir="demo_frames_2",
            motion_threshold=5000,
            progress_callback=demo_progress
        )
        print(f"\nConvenience function saved {frames_saved} frames")
        
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)