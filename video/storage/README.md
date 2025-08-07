# Storage Layer

`StorageEngine` defines the contract for persisting binaries and optional vector data.  `AutoStorage` is the default implementation that combines a SQLite media database with an optional vector store.

## When to use

| Use this | When |
|---------|------|
| `StorageEngine` | writing your own backend |
| `AutoStorage`   | want a ready‑to‑run store with sensible defaults |

## Example

```python
from video.storage.auto import AutoStorage

store = AutoStorage()
sha1 = store.add_video("clip.mp4")
print("stored", sha1)
```

## Design Notes

`AutoStorage` falls back gracefully when a vector backend is missing and works in both CLI and async server contexts.

