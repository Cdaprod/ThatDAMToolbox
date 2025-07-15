# video/storage/README.md

## Storage Layer Architecture

This `video/storage/` layer is an excellent example of architected polymorphism in a Digital Asset Management (DAM) system--cleanly abstracted, extensible, and layered with graceful fallback. Here’s how this maps into DAM system architecture and what it empowers you to do next:

⸻

## 🧱 1. Abstracted Storage Layer: StorageEngine

**File:** `/video/storage/base.py`

This is your interface layer--pure ABC, no storage decisions. It establishes the contract for any backend, cleanly divided into two concerns:

- `add_video`, `get_video`, `list_videos` → core metadata operations
- `add_vector`, `search_vector` → optional vector layer, with defaults

This is textbook "ports and adapters" / hexagonal architecture: everything upstream (processing, API, CLI) should only call this interface, never the implementation.

💡 **Think of this like `IStorageAdapter` in a domain-driven or Onion model.** It ensures testability, modularity, and runtime flexibility.

⸻

## 🔌 2. Adaptive Orchestration Layer: AutoStorage

**File:** `/video/storage/auto.py`

This is your adaptive implementation, conforming to `StorageEngine`, and gracefully composing:

- 📂 **MediaDB** – stdlib SQLite persistence
- 🧠 **VectorStorage** – optional vector layer (FAISS, Weaviate, Milvus)

### Design Strengths:

- Runtime fallback if vector layer is unavailable
- Event loop bootstrapping via `_ensure_event_loop_running()` → safe async/sync compatibility
- Log-backed debug for missing vector capabilities

This makes your stack resilient and suitable for:

- **CLI mode** (no vector, low memory)
- **Full DAM server** (async FAISS + rich metadata)

💡 **This is your default concrete adapter in the adapter pattern.** It lets you switch persistence or add performance without changing business logic.

⸻

## 💡 Architectural Observations

### ✅ You’ve Implemented:

|Layer             |Concept      |File                |
|------------------|-------------|--------------------|
|Interface         |StorageEngine|base.py             |
|Concrete Adapter  |AutoStorage  |auto.py             |
|Vector Abstraction|VectorStorage|(dam.models.storage)|
|Metadata Database |MediaDB      |(video.db)          |

### ✅ You’ve Honored:

- **Single Responsibility:** each class does one thing.
- **Open/Closed Principle:** AutoStorage can be extended without changing it.
- **Dependency Inversion:** You depend on abstractions, not implementations.

⸻

## 🔭 Next Logical Enhancements

Here’s where you can evolve this layer forward as your DAM system matures:

### 1. Plugin Registry / Factory

Abstract a plugin system so you can plug different backends (MinIO, S3, Synology NAS, etc.) or vectors via:

```python
from .factory import get_storage_backend

store = get_storage_backend(kind="s3", config=...)
```

Factory can use entrypoints or config-based dispatch.

⸻

### 2. Storage Tiers & Lifecycle Policies

Introduce tiering logic in AutoStorage:

```python
if meta.get("age") > timedelta(days=30):
    self.archive_to_cold_storage(...)
```

Could integrate S3 glacier, MinIO ILM, or your own NAS migration toolchain.

⸻

### 3. StorageEngineContext / Thread-Local Sessions

To support concurrent CLI, server, and preview threads, consider:

```python
from contextvars import ContextVar

_current_storage = ContextVar("current_storage", default=AutoStorage())

def get_storage():
    return _current_storage.get()
```

This keeps environments isolated (test, server, preview tool) without passing around store.

⸻

### 4. Previews, Thumbnails, Hash Index

Add hooks to `add_video()` to:

- Trigger `generate_preview(path)`
- Add SHA1 to thumbnail cache
- Enqueue preview renderer via event bus (RabbitMQ or local)

⸻

### 5. Abstract Lifecycle Events

Turn `add_video()` into an orchestrator of domain events:

```python
self._db.upsert_file(row)
self.emit("video_added", sha1=sha1, meta=meta)
```

Let vector layer, preview renderer, and event queue subscribe to those.

⸻

## 📁 Summary (Architecture Layer Placement)

```
/video/storage/
├── base.py        → Abstract contract
├── auto.py        → Default implementation w/ vector fallback
├── media_db.py    → (external) Concrete metadata backend
├── vector/        → (external) Vector layer (FAISS, Weaviate, etc.)
```

📌 **All of this sits in:**
**"Physical / Storage Layer" + "Metadata Layer"**
☝️ this is the base tier of your DAM’s layered architecture

⸻

## 🚀 Next Steps

- A diagram mapping this out visually?
- A `factory.py` starter with pluggable backends?
- Guidance on metadata lifecycle or preview pipelines?

Let’s take the next step!