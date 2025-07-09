# app/core/processor.py

from typing import Dict, Any, Optional
from app.core.artifacts.batch import BatchArtifact
from app.core.artifacts.video import VideoArtifact

class BatchProcessor:
    """
    Processes BatchArtifact instances through their full lifecycle:
      1. start_processing()
      2. run each VideoArtifact through _process_video()
      3. call complete_video() or fail_video() for each
      4. finalize() the batch when done
    """

    def __init__(self):
        self.active_batches: Dict[str, BatchArtifact] = {}

    def process_batch(self, batch: BatchArtifact) -> BatchArtifact:
        """
        Run the given batch through validation, per-item processing, and finalization.
        Stores the batch in self.active_batches for status lookups.
        """
        # register
        self.active_batches[batch.id] = batch

        # kick off
        if batch.start_processing():
            for video in batch.videos:
                try:
                    results = self._process_video(video, batch.config)
                    batch.complete_video(video, results)
                except Exception as e:
                    batch.fail_video(video, str(e))
            # once every item is done, mark batch complete
            batch.finalize()

        return batch

    def _process_video(self, video: VideoArtifact, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mock implementation of a per-video processing step.
        Replace with your actual FFmpeg/ML/etc. logic.
        """
        # example dummy results -- swap in real work here
        return {
            "output_path": f"./outputs/{video.id}_processed.{config.get('format','mp4')}",
            "processing_time": 2.5,
            "inference_results": {
                "confidence": 0.95,
                "predictions": ["object1", "object2"],
                "frames_processed": (
                    int(video.duration * video.frame_rate)
                    if video.duration and video.frame_rate else 0
                )
            }
        }

    def get_batch_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve the serialized manifest of an in-flight or completed batch.
        Returns None if the batch_id isn't known.
        """
        batch = self.active_batches.get(batch_id)
        return batch.to_dict() if batch else None