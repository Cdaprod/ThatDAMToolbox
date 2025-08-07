# DAM Models

Utility classes backing the DAM module:

- `embeddings.py` – generate vector representations
- `faiss_store.py` – persistent FAISS index
- `hierarchy.py` – four‑level (L0–L3) vector hierarchy
- `storage.py` – adapters linking vectors to the storage engine

Vectors are stored per artifact at multiple levels so searches can mix coarse and fine features.

