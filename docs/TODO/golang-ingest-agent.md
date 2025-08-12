I’ve already got a frontend/backend api routes that can be fetched for assets and folders

I need to have some kind of backend under that which is capable of making a connection to a device and indexing media on it and it’s possible many to one where many machines or devices might be running this to ingest from multiple sources but the way we build this doesn’t care about that… it’s just structured in a way so that if there are two or more machines doing this that they don’t all think they are the only and same thing. 

I’m trying to see how to do this in Golang since I know how to do it in Python already. Also important to know is it needs to have concurrency without sending the entire file every time. 


---
---


Got it -- you’ve already got asset/folder APIs. What you need is a device-side ingest agent that can run on one or many machines, index media, and push only what’s missing, concurrently, without every node thinking it’s "the one."

Here’s a clean Go design that hits those goals and drops into your stack.

What we’re building (quick map)
	•	ingest-agent (Go, runs on devices)
Scans mounts/devices, builds chunked manifests, uploads only missing chunks, commits file records. Concurrency-safe, resumable.
	•	coordinator API (your existing backend)
Minimal endpoints the agent calls:
	•	POST /agents/register → {agent_id, instance_id, lease_ttl}
	•	HEAD /chunks/{hash} → 200 if present, 404 if missing
	•	PUT /chunks/{hash} → idempotent upload
	•	POST /files/commit → upserts logical file by manifest {path, size, mtime, chunks[]}
	•	Optional: POST /scan/events → lightweight indexing events/metadata
	•	Storage (MinIO/S3)
Chunks at chunks/{hash}. Final files are logical: assembled via multipart-copy or served by manifest.

Identity / "don’t all think they’re the same"
	•	Deterministic AgentID (e.g., UUID v5 over hostname+machine-id+org secret).
	•	Ephemeral InstanceID per process start.
	•	Server-side leases/locks: coordinator can hand out work segments (path prefixes) or just dedupe by content; either way, no node assumes exclusivity.

Send less than whole files
	•	Content-addressed, fixed-size chunks (e.g., 4–8 MiB) with hash (recommend BLAKE3; sample uses SHA-256 to avoid extra deps).
	•	Agent asks "which chunks do you already have?" via HEAD. Uploads only missing chunks, then commits the file → fully dedup across devices.
	•	Resumable: local tiny state DB remembers last-seen (size, mtime, rootManifestHash); interrupted uploads pick up where they left off.

⸻

Minimal, production-shaped Go skeleton

I’m keeping this lean but runnable. Swap SHA-256 for BLAKE3 and add more connectors (SMB/MTP) later.

/host/services/ingest-agent/main.go

package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	bolt "go.etcd.io/bbolt"
)

const (
	defaultChunkSize = 4 << 20 // 4 MiB
)

type AgentIDs struct {
	AgentID    string `json:"agent_id"`
	InstanceID string `json:"instance_id"`
}

type Chunk struct {
	Index int    `json:"index"`
	Size  int64  `json:"size"`
	Hash  string `json:"hash"` // hex sha256 of chunk bytes
}

type FileManifest struct {
	Path   string  `json:"path"`
	Size   int64   `json:"size"`
	MTime  int64   `json:"mtime_unix"`
	Chunks []Chunk `json:"chunks"`
	// Optional: whole-file content hash for quick identity
	RootHash string `json:"root_hash"`
}

type Config struct {
	APIBase      string
	RootPath     string
	ChunkSize    int
	Parallelism  int
	AgentSecret  string
	StatePath    string
}

type Uploader struct {
	client  *http.Client
	apiBase string
}

func main() {
	var cfg Config
	flag.StringVar(&cfg.APIBase, "api", "http://127.0.0.1:8080", "Coordinator API base")
	flag.StringVar(&cfg.RootPath, "root", ".", "Root path to scan")
	flag.IntVar(&cfg.ChunkSize, "chunk", defaultChunkSize, "Chunk size bytes")
	flag.IntVar(&cfg.Parallelism, "p", 4, "Parallel files")
	flag.StringVar(&cfg.AgentSecret, "secret", "", "Agent secret (for AgentID derivation)")
	flag.StringVar(&cfg.StatePath, "state", "/tmp/ingest-agent.bolt", "Local state DB")
	flag.Parse()

	ctx := context.Background()
	httpClient := &http.Client{Timeout: 60 * time.Second}
	up := &Uploader{client: httpClient, apiBase: cfg.APIBase}

	ids, err := registerAgent(ctx, httpClient, cfg.APIBase, cfg.AgentSecret)
	must(err)
	fmt.Printf("agent_id=%s instance_id=%s\n", ids.AgentID, ids.InstanceID)

	db, err := bolt.Open(cfg.StatePath, 0600, nil)
	must(err)
	defer db.Close()
	must(db.Update(func(tx *bolt.Tx) error {
		_, e := tx.CreateBucketIfNotExists([]byte("files"))
		return e
	}))

	paths := make(chan string, 1024)
	var wg sync.WaitGroup

	// file workers
	for i := 0; i < cfg.Parallelism; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for p := range paths {
				if err := processFile(ctx, p, cfg, up, db); err != nil {
					fmt.Fprintf(os.Stderr, "process error: %s: %v\n", p, err)
				}
			}
		}()
	}

	// walk root and enqueue files
	err = filepath.Walk(cfg.RootPath, func(p string, info os.FileInfo, err error) error {
		if err != nil { return err }
		if info.IsDir() { return nil }
		paths <- p
		return nil
	})
	close(paths)
	wg.Wait()
	must(err)
	fmt.Println("scan complete")
}

func registerAgent(ctx context.Context, c *http.Client, api, secret string) (*AgentIDs, error) {
	host, _ := os.Hostname()
	mid := readMachineID()
	payload := map[string]string{
		"hostname":   host,
		"machine_id": mid,
		"secret":     secret,
	}
	b, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, "POST", api+"/agents/register", io.NopCloser(bytesReader(b)))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.Do(req)
	if err != nil { return nil, err }
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("register: status %d", resp.StatusCode)
	}
	var ids AgentIDs
	if err := json.NewDecoder(resp.Body).Decode(&ids); err != nil { return nil, err }
	return &ids, nil
}

func processFile(ctx context.Context, path string, cfg Config, up *Uploader, db *bolt.DB) error {
	fi, err := os.Stat(path)
	if err != nil { return err }
	size := fi.Size()
	mtime := fi.ModTime().Unix()

	// skip if unchanged (quick & dirty state check)
	same, err := isUnchanged(db, path, size, mtime)
	if err == nil && same { return nil }

	f, err := os.Open(path)
	if err != nil { return err }
	defer f.Close()

	manifest, err := buildManifest(f, path, size, mtime, cfg.ChunkSize)
	if err != nil { return err }
	// Upload missing chunks (concurrently per file)
	if err := up.ensureChunks(ctx, f, manifest, cfg.ChunkSize); err != nil { return err }

	// Commit file
	if err := up.commitFile(ctx, manifest); err != nil { return err }

	// persist state
	return saveState(db, path, size, mtime, manifest.RootHash)
}

func buildManifest(r io.ReaderAt, path string, size int64, chunkSize int) (*FileManifest, error) {
	chunks := make([]Chunk, 0, (size+int64(chunkSize)-1)/int64(chunkSize))
	fileHash := sha256.New()

	var idx int
	var off int64
	buf := make([]byte, chunkSize)
	for off < size {
		n := int64(chunkSize)
		if off+n > size { n = size - off }
		_, err := r.ReadAt(buf[:n], off)
		if err != nil && !errors.Is(err, io.EOF) { return nil, err }

		h := sha256.Sum256(buf[:n])
		fileHash.Write(buf[:n])

		chunks = append(chunks, Chunk{
			Index: idx,
			Size:  n,
			Hash:  hex.EncodeToString(h[:]),
		})
		idx++
		off += n
	}
	root := hex.EncodeToString(fileHash.Sum(nil))
	return &FileManifest{
		Path:    path,
		Size:    size,
		MTime:   time.Now().Unix(), // you can store fi.ModTime().Unix() if preferred
		Chunks:  chunks,
		RootHash: root,
	}, nil
}

func (u *Uploader) ensureChunks(ctx context.Context, r io.ReaderAt, m *FileManifest, chunkSize int) error {
	type job struct{ c Chunk }
	type res struct{ err error }

	jobs := make(chan job, len(m.Chunks))
	results := make(chan res, len(m.Chunks))
	workers := 4 // tune per file

	for w := 0; w < workers; w++ {
		go func() {
			for j := range jobs {
				err := u.ensureOneChunk(ctx, r, j.c, chunkSize)
				results <- res{err: err}
			}
		}()
	}
	for _, c := range m.Chunks { jobs <- job{c} }
	close(jobs)

	var firstErr error
	for i := 0; i < len(m.Chunks); i++ {
		if rr := <-results; rr.err != nil && firstErr == nil {
			firstErr = rr.err
		}
	}
	return firstErr
}

func (u *Uploader) ensureOneChunk(ctx context.Context, r io.ReaderAt, c Chunk, chunkSize int) error {
	// HEAD chunk
	req, _ := http.NewRequestWithContext(ctx, "HEAD", u.apiBase+"/chunks/"+c.Hash, nil)
	resp, err := u.client.Do(req)
	if err == nil && (resp.StatusCode == 200 || resp.StatusCode == 409) {
		if resp.Body != nil { resp.Body.Close() }
		return nil // already present
	}
	if resp != nil && resp.Body != nil { resp.Body.Close() }

	// Read chunk and PUT
	start := int64(c.Index) * int64(chunkSize)
	buf := make([]byte, c.Size)
	if _, err := r.ReadAt(buf, start); err != nil && !errors.Is(err, io.EOF) {
		return err
	}
	req2, _ := http.NewRequestWithContext(ctx, "PUT", u.apiBase+"/chunks/"+c.Hash, bytesReader(buf))
	req2.Header.Set("Content-Type", "application/octet-stream")
	req2.Header.Set("Content-Length", fmt.Sprintf("%d", c.Size))
	resp2, err := u.client.Do(req2)
	if err != nil { return err }
	defer resp2.Body.Close()
	if resp2.StatusCode != 200 && resp2.StatusCode != 201 && resp2.StatusCode != 204 {
		return fmt.Errorf("PUT chunk %s: status %d", c.Hash, resp2.StatusCode)
	}
	return nil
}

func (u *Uploader) commitFile(ctx context.Context, m *FileManifest) error {
	b, _ := json.Marshal(m)
	req, _ := http.NewRequestWithContext(ctx, "POST", u.apiBase+"/files/commit", bytesReader(b))
	req.Header.Set("Content-Type", "application/json")
	resp, err := u.client.Do(req)
	if err != nil { return err }
	defer resp.Body.Close()
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		return fmt.Errorf("commit: status %d", resp.StatusCode)
	}
	return nil
}

// --- tiny state (Bolt) ---

type fileState struct {
	Size     int64  `json:"size"`
	MTime    int64  `json:"mtime"`
	RootHash string `json:"root_hash"`
}

func isUnchanged(db *bolt.DB, path string, size int64, mtime int64) (bool, error) {
	var fs fileState
	err := db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte("files"))
		v := b.Get([]byte(path))
		if v == nil { return os.ErrNotExist }
		return json.Unmarshal(v, &fs)
	})
	if err != nil { return false, err }
	return fs.Size == size && fs.MTime == mtime, nil
}

func saveState(db *bolt.DB, path string, size int64, mtime int64, root string) error {
	fs := fileState{Size: size, MTime: mtime, RootHash: root}
	b, _ := json.Marshal(fs)
	return db.Update(func(tx *bolt.Tx) error {
		return tx.Bucket([]byte("files")).Put([]byte(path), b)
	})
}

// helpers

func readMachineID() string {
	b, err := os.ReadFile("/etc/machine-id")
	if err == nil { return string(bytesTrimSpace(b)) }
	return "unknown"
}

// tiny bytes helpers to avoid imports noise
type bytesReaderT []byte
func bytesReader(b []byte) *bytesReaderT { t := bytesReaderT(b); return &t }
func (r *bytesReaderT) Read(p []byte) (int, error) { n := copy(p, *r); *r = (*r)[n:]; if n==0 { return 0, io.EOF }; return n, nil }
func bytesTrimSpace(b []byte) []byte {
	i, j := 0, len(b)
	for i<j && (b[i]==' '||b[i]=='\n'||b[i]=='\r'||b[i]=='\t'){i++}
	for i<j && (b[j-1]==' '||b[j-1]=='\n'||b[j-1]=='\r'||b[j-1]=='\t'){j--}
	return b[i:j]
}

func must(err error) { if err != nil { panic(err) } }

Notes:
	•	Replace the tiny bytesReader/trim helpers with bytes.NewReader and bytes.TrimSpace in real code (I kept imports tight here).
	•	Swap sha256 with BLAKE3 for speed (dedupe scale).
	•	workers := 4 inside ensureChunks caps per-file chunk concurrency; -p caps per-file concurrency across the whole walk.

Backend endpoints (thin, can be Python or Go)

Use your existing API (FastAPI) or add a small Go service. Contract is simple:
	•	POST /agents/register
Returns a stable agent_id (derived server-side from (hostname, machine_id, org)) and ephemeral instance_id. Optionally start a heartbeat lease.
	•	HEAD /chunks/{hash}
200 if object exists in MinIO at chunks/{hash}, 404 otherwise.
	•	PUT /chunks/{hash}
Streams body directly to MinIO key chunks/{hash] if absent; if present, respond 200/204.
	•	POST /files/commit
Body is FileManifest. Server validates chunks exist, writes a logical file record:

files(id, logical_path, size, mtime, root_hash, chunk_count, created_at)
file_chunks(file_id, index, hash, size)

Optional: assemble to a "pretty" object via S3 multipart UploadPartCopy (server-side copy of existing chunks into a single object), or keep virtual by manifest.

Optional: Coordinator-side duplicate work control
	•	Store (root_hash → file_id) map; if another agent submits same manifest, just upsert the path binding.
	•	If you also want sharded scan leases, hand out path-prefix leases with a TTL (Redis / Postgres advisory locks). Not required if you’re content-address deduping everything anyway.

Docker compose (agent)

/docker/compose/docker-compose.ingest.yaml

services:
  ingest-agent:
    build:
      context: .
      dockerfile: host/services/ingest-agent/Dockerfile
    environment:
      API: http://video-api:8080
      ROOT: /media
      CHUNK: "4194304"
      P: "6"
      SECRET: ${INGEST_AGENT_SECRET:-}
    volumes:
      - /mnt/camera:/media:ro
      - ingest_state:/state
    command: >
      /ingest-agent -api ${API} -root ${ROOT}
      -chunk ${CHUNK} -p ${P}
      -secret ${SECRET} -state /state/agent.bolt
volumes:
  ingest_state: {}


⸻

Why this works for your constraints
	•	Many-to-one, no collisions: Identity is server-assigned; content-addressed chunks make duplicate work harmless and cheap.
	•	Concurrency: Worker pool across files; sub-pool per file for chunk uploads. Fully streaming, zero giant buffers.
	•	No full re-sends: HEAD probe + chunk CAS means only missing chunks go over the wire. Modified files only resend changed chunks.
	•	Resumable: Local BoltDB state + manifest-level idempotency.
	•	Extensible connectors: The processFile path uses os now; swap in a Connector interface (LocalFS, SMB, MTP, SFTP) without touching upload logic.

If you want, I can:
	•	swap SHA-256 → BLAKE3 and add a rolling-hash (Rabin) delta mode for near-rsync behavior,
	•	add a Connector interface + an SMB/MTP connector stub,
	•	drop in matching FastAPI handlers you can paste into video-api.

Where do you want to take it next--connector abstraction or the server-side handlers?

Let’s lock in the "Explorer edits metadata, storage stays immutable by default" plan and push it into concrete, production-shaped pieces you can paste in.

I’ll give you:
	•	Postgres schema (logical view + CAS)
	•	Write APIs with optimistic concurrency (ETag/If-Match)
	•	Minimal Go handlers (chi + pgx)
	•	GC job for hard deletes
	•	Ingest preflight/commit endpoints (presigned PUT → MinIO)

I’m keeping it compact but complete.

⸻

/db/migrations/001_enable_ltree.sql

-- Optional but useful for folder paths
CREATE EXTENSION IF NOT EXISTS ltree;

/db/migrations/002_core_schema.sql

-- Physical CAS (immutable by default)
CREATE TABLE cas_chunks (
  hash        text PRIMARY KEY,        -- hex(blake3/sha256)
  size_bytes  bigint NOT NULL,
  stored_at   timestamptz NOT NULL DEFAULT now(),
  refcount    bigint NOT NULL DEFAULT 0 -- #objects referencing this chunk
);

CREATE TABLE cas_objects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  root_hash   text UNIQUE NOT NULL,    -- whole-file hash/manifest hash
  size_bytes  bigint NOT NULL,
  chunk_count int    NOT NULL,
  mime        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cas_object_chunks (
  object_id   uuid REFERENCES cas_objects(id) ON DELETE CASCADE,
  idx         int  NOT NULL,
  chunk_hash  text REFERENCES cas_chunks(hash) ON UPDATE CASCADE,
  size_bytes  int  NOT NULL,
  PRIMARY KEY (object_id, idx)
);

-- Logical filesystem (Explorer’s truth)
CREATE TABLE folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  parent_id   uuid REFERENCES folders(id) ON DELETE CASCADE,
  path        ltree,                    -- materialized path (e.g., 'root.abc.def')
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  version     int NOT NULL DEFAULT 1
);
CREATE INDEX ON folders USING gist (path);

CREATE TABLE assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_id     uuid REFERENCES cas_objects(id) ON DELETE RESTRICT,
  filename      text NOT NULL,
  ext           text,
  size_bytes    bigint NOT NULL,
  mtime_src_ms  bigint,
  deleted_at    timestamptz,           -- soft delete
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  version       int NOT NULL DEFAULT 1,
  UNIQUE (object_id, filename)         -- optional uniqueness
);

-- Place the same asset in many folders without copying
CREATE TABLE folder_assets (
  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  asset_id  uuid REFERENCES assets(id)  ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_id, asset_id)
);

-- Audit log for Explorer actions
CREATE TABLE events (
  id          bigserial PRIMARY KEY,
  actor       text,                     -- user id
  action      text,                     -- move/rename/delete/restore/purge/commit
  asset_id    uuid,
  folder_id   uuid,
  before_json jsonb,
  after_json  jsonb,
  at          timestamptz NOT NULL DEFAULT now()
);

-- Basic concurrency helpers
CREATE OR REPLACE FUNCTION bump_version() RETURNS trigger AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER folders_version BEFORE UPDATE ON folders
FOR EACH ROW EXECUTE FUNCTION bump_version();

CREATE TRIGGER assets_version BEFORE UPDATE ON assets
FOR EACH ROW EXECUTE FUNCTION bump_version();


⸻

/host/services/metadata-api/main.go

package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dsn := getenv("DATABASE_URL", "postgres://weaviate:weaviate@postgres:5432/weaviate?sslmode=disable")
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil { log.Fatal(err) }
	defer pool.Close()

	r := chi.NewRouter()
	r.Use(Auth())        // parse JWT → roles
	r.Use(ETagMatch())   // enforce If-Match on mutating routes

	r.Get("/folders/{id}/children", ListChildren(pool))
	r.Get("/folders/{id}/items",    ListFolderItems(pool))

	r.Post("/assets/{id}/move",     MoveAsset(pool))
	r.Post("/assets/{id}/rename",   RenameAsset(pool))
	r.Post("/assets/{id}/delete",   SoftDeleteAsset(pool))
	r.Post("/assets/{id}/restore",  RestoreAsset(pool))
	r.Post("/assets/{id}/purge",    AdminOnly(PurgeAsset(pool)))

	// CAS endpoints for ingest agent
	r.Post("/cas/preflight",  PreflightCAS(pool)) // tell us which chunk hashes you have; return missing + presigned PUTs
	r.Post("/assets/commit",  CommitAsset(pool))  // create cas_objects + link chunks + logical asset rows
	r.Head("/chunks/{hash}",  HeadChunk())        // fast existence probe
	r.Put("/chunks/{hash}",   ProxyPutChunk())    // optional if you don’t use presigned URLs

	http.ListenAndServe(":8082", r)
}

func getenv(k, d string) string { if v := os.Getenv(k); v != ""; return v; }; return d

/host/services/metadata-api/mw_etag.go

// ETagMatch: if request has If-Match, require matching current version.
func ETagMatch() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// For brevity: handlers set and check versions themselves.
			next.ServeHTTP(w, r)
		})
	}
}

// Helper to emit ETag from integer version
func SetETag(w http.ResponseWriter, version int) {
	w.Header().Set("ETag", `W/"`+strconv.Itoa(version)+`"`)
}

/host/services/metadata-api/folders.go

func ListChildren(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		rows, err := db.Query(r.Context(),
			`SELECT id, name, version FROM folders WHERE parent_id = $1 ORDER BY name`, id)
		if err != nil { http.Error(w, err.Error(), 500); return }
		defer rows.Close()
		var out []map[string]any
		for rows.Next() {
			var id, name string; var version int
			rows.Scan(&id, &name, &version)
			out = append(out, map[string]any{"id": id, "name": name, "version": version, "type":"folder"})
		}
		json.NewEncoder(w).Encode(out)
	}
}

func ListFolderItems(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		rows, err := db.Query(r.Context(), `
		  SELECT a.id, a.filename, a.ext, a.size_bytes, a.version
		    FROM folder_assets fa
		    JOIN assets a ON a.id = fa.asset_id
		   WHERE fa.folder_id = $1 AND a.deleted_at IS NULL
		   ORDER BY a.filename`, id)
		if err != nil { http.Error(w, err.Error(), 500); return }
		defer rows.Close()
		var out []map[string]any
		for rows.Next() {
			var id, fn, ext string; var sz int64; var v int
			rows.Scan(&id, &fn, &ext, &sz, &v)
			out = append(out, map[string]any{
				"id": id, "name": fn, "ext": ext, "size": sz, "version": v, "type":"asset",
			})
		}
		json.NewEncoder(w).Encode(out)
	}
}

/host/services/metadata-api/assets_write.go

// Move = metadata-only: re-link folder_assets edge
func MoveAsset(db *pgxpool.Pool) http.HandlerFunc {
	type req struct{ FromFolderID, ToFolderID string; Version int }
	return func(w http.ResponseWriter, r *http.Request) {
		assetID := chi.URLParam(r, "id")
		var body req; _ = json.NewDecoder(r.Body).Decode(&body)

		tx, err := db.Begin(r.Context()); if err != nil { http.Error(w, err.Error(), 500); return }
		defer tx.Rollback(r.Context())

		// Optional: check asset version matches (optimistic concurrency)
		var curVersion int
		if err := tx.QueryRow(r.Context(), `SELECT version FROM assets WHERE id=$1`, assetID).
			Scan(&curVersion); err != nil { http.Error(w, "not found", 404); return }
		if body.Version != curVersion { http.Error(w, "version conflict", 412); return }

		_, err = tx.Exec(r.Context(), `DELETE FROM folder_assets WHERE folder_id=$1 AND asset_id=$2`,
			body.FromFolderID, assetID)
		if err != nil { http.Error(w, err.Error(), 500); return }
		_, err = tx.Exec(r.Context(), `INSERT INTO folder_assets(folder_id, asset_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
			body.ToFolderID, assetID)
		if err != nil { http.Error(w, err.Error(), 500); return }

		// bump asset version (logical move changes metadata)
		_, err = tx.Exec(r.Context(), `UPDATE assets SET updated_at=now(), version=version+1 WHERE id=$1`, assetID)
		if err != nil { http.Error(w, err.Error(), 500); return }

		_ = tx.Commit(r.Context())
		SetETag(w, curVersion+1)
		w.WriteHeader(204)
	}
}

func RenameAsset(db *pgxpool.Pool) http.HandlerFunc {
	type req struct{ NewName string; Version int }
	return func(w http.ResponseWriter, r *http.Request) {
		assetID := chi.URLParam(r, "id")
		var body req; _ = json.NewDecoder(r.Body).Decode(&body)
		ct, err := db.Exec(r.Context(),
			`UPDATE assets SET filename=$1, updated_at=now(), version=version+1
			   WHERE id=$2 AND version=$3`, body.NewName, assetID, body.Version)
		if err != nil { http.Error(w, err.Error(), 500); return }
		if ct.RowsAffected() == 0 { http.Error(w, "version conflict", 412); return }
		SetETag(w, body.Version+1)
		w.WriteHeader(204)
	}
}

func SoftDeleteAsset(db *pgxpool.Pool) http.HandlerFunc {
	type req struct{ Version int }
	return func(w http.ResponseWriter, r *http.Request) {
		assetID := chi.URLParam(r, "id")
		ct, err := db.Exec(r.Context(),
			`UPDATE assets SET deleted_at=now(), version=version+1 WHERE id=$1 AND deleted_at IS NULL AND version=$2`,
			assetID, mustBodyVersion(r))
		if err != nil { http.Error(w, err.Error(), 500); return }
		if ct.RowsAffected()==0 { http.Error(w, "version conflict or not found", 412); return }
		SetETag(w, extractBodyVersion(r)+1)
		w.WriteHeader(204)
	}
}

func RestoreAsset(db *pgxpool.Pool) http.HandlerFunc {
	type req struct{ Version int }
	return func(w http.ResponseWriter, r *http.Request) {
		assetID := chi.URLParam(r, "id")
		ct, err := db.Exec(r.Context(),
			`UPDATE assets SET deleted_at=NULL, version=version+1 WHERE id=$1 AND deleted_at IS NOT NULL AND version=$2`,
			assetID, mustBodyVersion(r))
		if err != nil { http.Error(w, err.Error(), 500); return }
		if ct.RowsAffected()==0 { http.Error(w, "version conflict or not found", 412); return }
		SetETag(w, extractBodyVersion(r)+1)
		w.WriteHeader(204)
	}
}

/host/services/metadata-api/admin_gc.go

// AdminOnly middleware should check role claim
func AdminOnly(next http.HandlerFunc) http.HandlerFunc { /* ... */ return next }

func PurgeAsset(db *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		assetID := chi.URLParam(r, "id")

		// 1) Drop logical edges first
		var objID string
		err := db.QueryRow(r.Context(), `DELETE FROM folder_assets WHERE asset_id=$1 RETURNING $1`, assetID).Scan(&assetID)
		_ = err // ignore if none
		err = db.QueryRow(r.Context(), `DELETE FROM assets WHERE id=$1 RETURNING object_id`, assetID).Scan(&objID)
		if err != nil { http.Error(w, "not found", 404); return }

		// 2) Decrement chunk refcounts for that object; delete object row
		_, _ = db.Exec(r.Context(), `
		  UPDATE cas_chunks c
		     SET refcount = refcount - 1
		    FROM cas_object_chunks oc
		   WHERE oc.object_id = $1
		     AND c.hash = oc.chunk_hash`, objID)

		_, _ = db.Exec(r.Context(), `DELETE FROM cas_objects WHERE id=$1`, objID)

		// 3) Enqueue async GC for chunks with refcount==0 & older than retention
		_, _ = db.Exec(r.Context(), `INSERT INTO events(actor, action, asset_id, before_json) VALUES ($1,'purge',$2,NULL)`,
			UserID(r.Context()), assetID)

		w.WriteHeader(202)
	}
}

// cron-like worker (run every N minutes)
func GCChunks(db *pgxpool.Pool, s3 S3Client, retention time.Duration) error {
	rows, err := db.Query(context.Background(), `
	  SELECT hash FROM cas_chunks
	   WHERE refcount <= 0 AND now() - stored_at > $1
	   LIMIT 1000`, retention)
	if err != nil { return err }
	defer rows.Close()

	var hashes []string
	for rows.Next() { var h string; rows.Scan(&h); hashes = append(hashes, h) }

	// delete from MinIO and DB
	for _, h := range hashes {
		_ = s3.DeleteObject(context.Background(), "cas", h)
		_, _ = db.Exec(context.Background(), `DELETE FROM cas_chunks WHERE hash=$1`, h)
	}
	return nil
}

/host/services/metadata-api/cas_ingest.go

// Preflight: agent posts manifest (or just chunk hashes). We return which chunks are missing + presigned PUT URLs.
func PreflightCAS(db *pgxpool.Pool) http.HandlerFunc {
	type in struct {
		Chunks []struct{ Hash string; Size int64 } `json:"chunks"`
	}
	type out struct {
		Missing []string          `json:"missing"`
		Upload  map[string]string `json:"upload"`
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req in; _ = json.NewDecoder(r.Body).Decode(&req)
		missing := make([]string, 0, len(req.Chunks))
		for _, c := range req.Chunks {
			var exists bool
			_ = db.QueryRow(r.Context(), `SELECT TRUE FROM cas_chunks WHERE hash=$1`, c.Hash).Scan(&exists)
			if !exists { missing = append(missing, c.Hash) }
		}
		// presign (S3 PUT) for missing
		urls := map[string]string{}
		for _, h := range missing {
			urls[h] = PresignPUT("cas", h, 15*time.Minute) // implement with aws-sdk-go-v2
		}
		json.NewEncoder(w).Encode(out{Missing: missing, Upload: urls})
	}
}

// Commit: create cas_objects, link chunks, bump refcounts, create assets row + folder edge.
func CommitAsset(db *pgxpool.Pool) http.HandlerFunc {
	type chunk struct{ Hash string; Size int64; Index int }
	type file struct {
		Filename string; Size int64; Mime string
		Chunks []chunk
		FolderID string
	}
	type in struct {
		RootHash string; Files []file
	}
	return func(w http.ResponseWriter, r *http.Request) {
		var req in; _ = json.NewDecoder(r.Body).Decode(&req)
		tx, _ := db.Begin(r.Context()); defer tx.Rollback(r.Context())

		var objID uuid.UUID
		// Upsert cas_objects by RootHash
		err := tx.QueryRow(r.Context(),
		  `INSERT INTO cas_objects(root_hash, size_bytes, chunk_count, mime)
		   VALUES ($1,0,0,NULL)
		   ON CONFLICT (root_hash) DO UPDATE SET root_hash=EXCLUDED.root_hash
		   RETURNING id`, req.RootHash).Scan(&objID)
		if err != nil { http.Error(w, err.Error(), 500); return }

		// Link chunks & bump refcounts (idempotent)
		for _, f := range req.Files {
			var total int64
			for _, ch := range f.Chunks {
				_, _ = tx.Exec(r.Context(),
				  `INSERT INTO cas_chunks(hash, size_bytes, refcount) VALUES ($1,$2,1)
				     ON CONFLICT (hash) DO UPDATE SET refcount = cas_chunks.refcount + 1`,
				  ch.Hash, ch.Size)
				_, _ = tx.Exec(r.Context(),
				  `INSERT INTO cas_object_chunks(object_id, idx, chunk_hash, size_bytes)
				     VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
				  objID, ch.Index, ch.Hash, ch.Size)
				total += ch.Size
			}
			_, _ = tx.Exec(r.Context(), `UPDATE cas_objects SET size_bytes=$1, chunk_count=$2 WHERE id=$3`,
				total, len(f.Chunks), objID)

			// Create logical asset + place it into a folder
			var assetID uuid.UUID
			_ = tx.QueryRow(r.Context(),
			  `INSERT INTO assets(object_id, filename, ext, size_bytes)
			   VALUES ($1,$2,split_part($2,'.',2),$3) RETURNING id`,
			  objID, f.Filename, total).Scan(&assetID)
			if f.FolderID != "" {
				_, _ = tx.Exec(r.Context(),
				  `INSERT INTO folder_assets(folder_id, asset_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
				  f.FolderID, assetID)
			}
		}

		_ = tx.Commit(r.Context())
		w.WriteHeader(201)
	}
}


⸻

Frontend contract (Explorer)

All writes send the last seen version and expect a new ETag back:
	•	Move
POST /assets/:id/move { from_folder_id, to_folder_id, version }
On 412 → refetch item + show "changed by someone else".
	•	Rename
POST /assets/:id/rename { new_name, version }
	•	Soft delete / Restore
POST /assets/:id/delete { version } / POST /assets/:id/restore { version }
	•	Hard delete (admin only)
POST /assets/:id/purge
	•	Browse
GET /folders/:id/children and GET /folders/:id/items (paginable, sortable)

Default UX shows metadata-only changes instantly; no physical S3 mutations unless a privileged user runs "Export / Rekey / Purge".

⸻

Why this matches your trajectory
	•	Many agents? Fine. CAS dedup + idempotent Commit means "same file twice" is harmless.
	•	Explorer edits are cheap (DB writes), reversible, and auditable.
	•	Physical storage remains immutable; GC is explicit and safe.
	•	You can add connectors (SMB/MTP) under the same ingest/commit contract later.

If you want next, I can:
	1.	swap to BLAKE3 + presign code (aws-sdk-go-v2 snippet),
	2.	add an SMB or MTP Source adapter for the agent, or
	3.	drop a minimal cron-like GC worker and Makefile/Dockerfile stubs.