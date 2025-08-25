"""Tests for AutoStorage helper methods.

Example:
    pytest video/storage/tests/test_auto.py -q
"""

from video.storage.auto import AutoStorage


def test_set_position_updates_order(tmp_path):
    db_file = tmp_path / 'db.sqlite3'
    store = AutoStorage(db_path=db_file)
    row = {
        'id': '1',
        'path': 'a.mp4',
        'size_bytes': 0,
        'mtime': 0,
        'mime': None,
        'width_px': None,
        'height_px': None,
        'duration_s': None,
        'batch': None,
        'sha1': 'abc',
        'created_at': 0,
        'preview_path': None,
    }
    store._db.upsert_file(row)
    store.set_position('abc', 3)
    row = store._db.get_file_by_sha1('abc')
    assert row['sort_order'] == 3
