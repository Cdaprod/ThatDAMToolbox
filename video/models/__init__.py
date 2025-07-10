# video/models/__init__.py
# (If these already exist, just import them; don’t redeclare.)

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class VideoArtifact(BaseModel):
    sha1:      str
    path:      str
    width:     int
    height:    int
    duration:  float
    mime:      str
    preview:   Optional[str] = None   # thumb URL if you have one
    metadata:  Dict[str, Any] = {}

class Slice(BaseModel):
    level:      str   # L0/L1/L2/L3
    start_time: float
    end_time:   float
    embedding:  Optional[List[float]] = None   # only if you want to expose it

class Manifest(BaseModel):
    batch_id:   str
    name:       str
    created_at: str
    artifacts:  List[VideoArtifact]
    slices:     Dict[str, List[Slice]] = Field(
        default_factory=dict,
        description="Keyed by video SHA-1"
    )

### Composed Model-View Frontend Card
class SceneThumb(BaseModel):
    time:   float
    url:    str     # pre-signed S3 URL or local /static/ path

class VideoCard(BaseModel):
    artifact:  VideoArtifact
    scenes:    List[SceneThumb]
    score:     Optional[float] = None

class CardResponse(BaseModel):
    batch_id: str
    items:    List[VideoCard]