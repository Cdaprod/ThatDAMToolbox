# DAM Module

Adds vector embeddings and FAISS search to the toolbox.

## Usage

### Build FAISS index

```bash
python -m video dam index /path/to/batch
```

### API examples

```bash
# search by text
curl -X POST -H 'Content-Type: application/json' \
     -d '{"query": "sunset"}' http://localhost:8080/dam/search

# list indexed videos
curl http://localhost:8080/dam/videos
```

### CLI verbs

See `commands.py` for `index`, `search` and `wipe` helpers.

Optional dependencies such as `faiss-cpu` can be installed with:

```bash
pip install -r video/modules/dam/requirements.txt
```

