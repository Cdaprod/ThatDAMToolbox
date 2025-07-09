from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, ConfigDict

class MediaProxyArtifact(BaseModel):
    """
    A flattened proxy representation of a VideoArtifact for API responses.
    """
    id: str
    filename: str
    source_type: str
    created_at: datetime
    state: str
    file_path: Optional[str]
    duration: Optional[float]
    resolution: Optional[List[int]]
    codec: Optional[str]
    bitrate: Optional[int]
    frame_rate: Optional[float]
    metadata: Dict[str, Any]
    events: List[Dict[str, Any]]

    model_config = ConfigDict(from_attributes=True)