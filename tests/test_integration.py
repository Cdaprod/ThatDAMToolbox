# tests/test_integration.py
""" 
Run with `pytest -q`
""" 
import pytest
import hashlib
from video.dam.models.hierarchy import VideoSlice
from video.core.artifacts.video import VideoArtifact
from video.core.artifacts.batch import BatchArtifact
from video.core.artifacts.base import ArtifactEventType, ArtifactState

def test_video_slice_is_subclass_and_fields():
    vs = VideoSlice(1.0, 3.5, "L2", metadata={"foo": "bar"})
    # 1) subclass of the core VideoArtifact
    assert isinstance(vs, VideoArtifact)
    # 2) hierarchy fields
    assert vs.level == "L2"
    assert pytest.approx(vs.start_time) == 1.0
    assert pytest.approx(vs.end_time)   == 3.5
    assert pytest.approx(vs.duration)   == 2.5
    # 3) metadata merged
    assert vs.metadata["foo"]   == "bar"
    assert vs.metadata["level"] == "L2"
    # 4) id is a 16‐char hex (sha256 truncated)
    assert isinstance(vs.id, str)
    assert len(vs.id) == 16
    # manual check of id generation
    expected = hashlib.sha256(b"1.0:3.5:L2").hexdigest()[:16]
    assert vs.id == expected

def test_video_slice_events_and_versioning():
    vs = VideoSlice(0.0, 1.0, "L1")
    # At least one CREATED event
    assert len(vs.events) >= 1
    evt = vs.events[0]
    assert evt.type == ArtifactEventType.CREATED
    assert evt.data.get("level") == "L1"
    # version should be >=2 (1 initial + emit)
    assert vs.version >= 2

def test_to_dict_includes_core_and_hierarchy_keys():
    vs = VideoSlice(2.0, 4.25, "L3")
    d = vs.to_dict()
    # core fields
    for core_key in ("id", "created_at", "state", "version", "events"):
        assert core_key in d
    # hierarchy fields
    for hier_key in ("level", "start_time", "end_time", "duration", "metadata"):
        assert hier_key in d
    # values correct
    assert d["level"] == "L3"
    assert pytest.approx(d["start_time"]) == 2.0
    assert pytest.approx(d["end_time"])   == 4.25
    assert pytest.approx(d["duration"])   == 2.25

def test_batchartifact_can_process_video_slice():
    # 1) create a batch
    batch = BatchArtifact(id="batch1", metadata={}, name="mybatch")
    assert batch.state == ArtifactState.CREATED
    # 2) add one slice
    vs = VideoSlice(0.0, 5.0, "L1")
    batch.add_video(vs)
    assert batch.total_videos == 1
    assert batch.videos == [vs]
    # 3) start processing
    ok = batch.start_processing()
    assert ok is True
    assert batch.state == ArtifactState.PROCESSING
    # 4) complete the slice
    batch.complete_video(vs, {"foo": "bar"})
    assert batch.processed_videos == 1
    # 5) finalize the batch
    batch.finalize()
    assert batch.state == ArtifactState.COMPLETED
    # 6) inspect the manifest
    manifest = batch.to_dict()
    assert manifest["name"] == "mybatch"
    assert manifest["total_videos"] == 1
    assert manifest["processed_videos"] == 1
    assert manifest["results"]["processed"] == 1

# ──────────────────────────────────────────────────────────────
#  Additional integration tests exercising larger batch flows
# ──────────────────────────────────────────────────────────────

def test_batchartifact_multiple_slices_flow():
    """
    Full happy-path lifecycle with >1 VideoSlice.
    Ensures counters, states, events and manifest stay consistent.
    """
    batch = BatchArtifact(id="multi-flow-001", metadata={}, name="multis")
    # 1) add three distinct slices
    slices = [
        VideoSlice(0.0,  2.0, "L1"),
        VideoSlice(2.0,  5.0, "L2"),
        VideoSlice(5.0, 10.0, "L3")
    ]
    for s in slices:
        batch.add_video(s)
    assert batch.total_videos == 3
    assert batch.processed_videos == 0
    assert batch.state == ArtifactState.CREATED

    # 2) kick off processing
    assert batch.start_processing() is True
    assert batch.state == ArtifactState.PROCESSING

    # 3) complete every slice
    for s in slices:
        batch.complete_video(s, {"quality": "ok"})
    assert batch.processed_videos == 3

    # 4) finalize and inspect manifest
    batch.finalize()
    assert batch.state == ArtifactState.COMPLETED
    man = batch.to_dict()
    assert man["total_videos"] == 3
    assert man["processed_videos"] == 3
    assert man["results"]["processed"] == 3
    # sanity-check event log length grew (CREATED + 3×ADDED + PROCESSING +
    # 3×COMPLETED + FINALIZED = ≥10, but allow future extra events)
    assert len(batch.events) >= 9


def test_batchartifact_finalize_without_processing_raises():
    """
    Guard-rail: cannot finalize while unprocessed slices remain.
    Implementation may raise or return False – accept either.
    """
    batch = BatchArtifact(id="invalid-finalize-001", metadata={}, name="oops")
    slc   = VideoSlice(0.0, 2.5, "L1")
    batch.add_video(slc)
    batch.start_processing()

    with pytest.raises(Exception):
        batch.finalize()


def test_video_slice_unique_ids_and_hash_stability():
    """
    IDs must be deterministic *and* unique across differing inputs.
    """
    a = VideoSlice(0.0, 1.0, "L1")
    b = VideoSlice(0.0, 1.0, "L2")      # different level
    c = VideoSlice(1.0, 2.0, "L1")      # different timing
    ids = {a.id, b.id, c.id}
    assert len(ids) == 3                # all unique

    # determinism: recreate "a" → identical ID
    a2 = VideoSlice(0.0, 1.0, "L1")
    assert a.id == a2.id