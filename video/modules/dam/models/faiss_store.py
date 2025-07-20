# video/dam/models/faiss_store.py
from .storage.base import StorageEngine          # ← type contract only
from video.db import SqliteStorage               # reuse meta tables
import faiss, numpy as np

class FaissStorage(SqliteStorage):
    def __init__(self, db="media_index.sqlite3"):
        super().__init__(db)
        self.index = faiss.IndexFlatIP(1024)
    def add_vector(self, sha1, level, vector, *_, **__):
        super().add_vector(sha1, level, vector, *_, **__)
        self.index.add(vector.astype("float32").reshape(1,-1))
    def search_vector(self, vector, level="all", limit=20, threshold=.7):
        D,I = self.index.search(vector.astype("float32").reshape(1,-1), limit)
        # translate I → sha1 rows via SQLite lookup …