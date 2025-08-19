I’ve got a golang distributed blobstore system with minio s3 adapter… not a FastAPI app

---

Perfect -- let’s wire presigned URLs directly in Go (no FastAPI, no AWS libs) using the official minio-go v7 client. I’ll give you a drop-in internal package plus optional HTTP handlers you can mount in your existing Go service. This covers:
	•	Presigned GET (temporary download)
	•	Presigned PUT (single-part upload; great for browser direct uploads up to a few GB)
	•	Chunked uploads via Compose (MinIO-native alternative to S3 MPU, so clients can upload N chunks with presigned PUTs and the server composes them later)

If you eventually need true S3 Multipart presigned UploadPart URLs, we can add a small SigV4 signer; minio-go doesn’t expose a public helper for that, so Compose is the simplest production-safe pattern in MinIO-first stacks.

⸻

BabyAGI Plan (brief)

Tasks
	1.	Make a reusable presigner for GET/PUT.
	2.	Add chunked upload flow (presign N chunk PUTs → server ComposeObject).
	3.	Provide minimal HTTP handlers to expose this to your gateway/UI.
	4.	Show Docker Compose wiring and usage examples.

Priority
	•	1 & 3 first (unblock browser uploads + downloads).
	•	2 when uploads exceed single-PUT comfort limits.
	•	4 last (infra glue).

Execute
Implement package → wire handlers → run in Compose.

⸻

1) Reusable Presigner Package

minio-go v7 API you’ll call under the hood:
	•	PresignedGetObject(ctx, bucket, key, expire, reqParams)
	•	PresignedPutObject(ctx, bucket, key, expire)
	•	ComposeObject(ctx, dst, srcs, opts) (MinIO-native)

Code

/path/internal/presign/presigner.go

package presign

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Options for initializing the presigner.
type Options struct {
	Endpoint   string // "minio:9000" or "play.min.io:443"
	Secure     bool
	AccessKey  string
	SecretKey  string
	Region     string // optional
	Bucket     string // default bucket
	DefaultTTL time.Duration
	MaxTTL     time.Duration
}

// Presigner encapsulates minio client + guardrails.
type Presigner struct {
	cl         *minio.Client
	bucket     string
	defaultTTL time.Duration
	maxTTL     time.Duration
}

// New creates a presigner from explicit options.
func New(opts Options) (*Presigner, error) {
	if opts.DefaultTTL == 0 {
		opts.DefaultTTL = 15 * time.Minute
	}
	if opts.MaxTTL == 0 {
		opts.MaxTTL = 12 * time.Hour
	}
	cl, err := minio.New(opts.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(opts.AccessKey, opts.SecretKey, ""),
		Secure: opts.Secure,
		Region: opts.Region,
	})
	if err != nil {
		return nil, err
	}
	return &Presigner{
		cl:         cl,
		bucket:     opts.Bucket,
		defaultTTL: opts.DefaultTTL,
		maxTTL:     opts.MaxTTL,
	}, nil
}

// NewFromEnv provides 12-factor wiring for containers.
func NewFromEnv() (*Presigner, error) {
	secure := false
	if v := os.Getenv("S3_SECURE"); v != "" {
		if v == "1" || v == "true" || v == "TRUE" || v == "yes" {
			secure = true
		}
	}
	defTTL := parseDur(os.Getenv("PRESIGN_DEFAULT_TTL"), 15*time.Minute)
	maxTTL := parseDur(os.Getenv("PRESIGN_MAX_TTL"), 12*time.Hour)
	return New(Options{
		Endpoint:   env("S3_ENDPOINT", "minio:9000"),
		Secure:     secure,
		AccessKey:  env("S3_ACCESS_KEY", "minioadmin"),
		SecretKey:  env("S3_SECRET_KEY", "minioadmin"),
		Region:     os.Getenv("S3_REGION"),
		Bucket:     env("S3_BUCKET", "thatdam"),
		DefaultTTL: defTTL,
		MaxTTL:     maxTTL,
	})
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
func parseDur(s string, def time.Duration) time.Duration {
	if s == "" {
		return def
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return def
	}
	return d
}
func (p *Presigner) clamp(ttl time.Duration) time.Duration {
	if ttl <= 0 {
		ttl = p.defaultTTL
	}
	if ttl > p.maxTTL {
		ttl = p.maxTTL
	}
	return ttl
}

// -------- Download (GET) --------

// PresignGET returns a temporary download URL.
// Optional response headers can be set (e.g. inline filename, content-type).
func (p *Presigner) PresignGET(
	ctx context.Context,
	bucket, key string,
	ttl time.Duration,
	respContentType, respDisposition string,
) (*url.URL, error) {
	if bucket == "" {
		bucket = p.bucket
	}
	ttl = p.clamp(ttl)

	q := url.Values{}
	if respContentType != "" {
		q.Set("response-content-type", respContentType)
	}
	if respDisposition != "" {
		q.Set("response-content-disposition", respDisposition)
	}
	return p.cl.PresignedGetObject(ctx, bucket, key, ttl, q)
}

// -------- Single-part Upload (PUT) --------

// PresignPUT returns a temporary PUT URL and a set of headers you SHOULD send
// with the upload request (mainly Content-Type).
type PutURL struct {
	URL     *url.URL
	Headers map[string]string
}

func (p *Presigner) PresignPUT(
	ctx context.Context,
	bucket, key string,
	ttl time.Duration,
	contentType string,
) (*PutURL, error) {
	if bucket == "" {
		bucket = p.bucket
	}
	ttl = p.clamp(ttl)

	u, err := p.cl.PresignedPutObject(ctx, bucket, key, ttl)
	if err != nil {
		return nil, err
	}
	h := map[string]string{}
	if contentType != "" {
		// Note: S3 does NOT bake Content-Type into PUT presigns; the client must send it.
		h["Content-Type"] = contentType
	}
	return &PutURL{URL: u, Headers: h}, nil
}

// -------- Chunked Upload via Compose (MinIO-native) --------

// ChunkObjectName creates a deterministic chunk key for a base object.
func ChunkObjectName(baseKey string, part int) string {
	return fmt.Sprintf("%s.__chunk__.%06d", baseKey, part)
}

// PresignChunkPUT gives a PUT URL for uploading one chunk object.
func (p *Presigner) PresignChunkPUT(
	ctx context.Context,
	bucket, baseKey string,
	part int,
	ttl time.Duration,
	contentType string,
) (*PutURL, string, error) {
	chunkKey := ChunkObjectName(baseKey, part)
	u, err := p.PresignPUT(ctx, bucket, chunkKey, ttl, contentType)
	if err != nil {
		return nil, "", err
	}
	return u, chunkKey, nil
}

// ComposeChunks merges uploaded chunk objects into the final object.
// It will create destination object at bucket/baseKey and can set Content-Type.
func (p *Presigner) ComposeChunks(
	ctx context.Context,
	bucket, baseKey string,
	totalParts int,
	contentType string,
) (string, error) {
	if bucket == "" {
		bucket = p.bucket
	}
	if totalParts <= 0 {
		return "", fmt.Errorf("totalParts must be > 0")
	}
	var srcs []minio.SourceInfo
	for i := 1; i <= totalParts; i++ {
		chunk := ChunkObjectName(baseKey, i)
		src, err := minio.NewSourceInfo(bucket, chunk, nil)
		if err != nil {
			return "", err
		}
		srcs = append(srcs, src)
	}
	dst, err := minio.NewDestinationInfo(bucket, baseKey, nil, nil)
	if err != nil {
		return "", err
	}
	opts := minio.ComposeObjectOptions{}
	if contentType != "" {
		opts.UserMetadata = map[string]string{"Content-Type": contentType}
	}

	if _, err = p.cl.ComposeObject(ctx, dst, srcs, opts); err != nil {
		return "", err
	}
	return baseKey, nil
}


⸻

2) Minimal HTTP Handlers (drop-in)

Mount these on your existing Go service (gateway, API, or a dedicated signer). They return JSON with the presigned URL + headers to send. You can secure this route with your existing auth.

/path/internal/httpx/presign_handlers.go

package httpx

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"your/module/internal/presign"
	"golang.org/x/net/context"
)

type PresignServer struct{ P *presign.Presigner }

func (s *PresignServer) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /presign/upload", s.upload)
	mux.HandleFunc("POST /presign/download", s.download)
	mux.HandleFunc("POST /presign/chunk", s.chunk)       // one chunk
	mux.HandleFunc("POST /presign/compose", s.compose)   // finalize
}

type uploadReq struct {
	Bucket      string `json:"bucket"`
	Key         string `json:"key"`
	ContentType string `json:"content_type"`
	TTLSeconds  int    `json:"ttl_seconds"`
}
type uploadResp struct {
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
}

func (s *PresignServer) upload(w http.ResponseWriter, r *http.Request) {
	var in uploadReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, err.Error(), 400); return
	}
	ctx := context.Background()
	u, err := s.P.PresignPUT(ctx, in.Bucket, in.Key, time.Duration(in.TTLSeconds)*time.Second, in.ContentType)
	if err != nil {
		http.Error(w, err.Error(), 500); return
	}
	json.NewEncoder(w).Encode(uploadResp{URL: u.URL.String(), Headers: u.Headers})
}

type downloadReq struct {
	Bucket        string `json:"bucket"`
	Key           string `json:"key"`
	TTLSeconds    int    `json:"ttl_seconds"`
	ResponseCT    string `json:"response_content_type"`
	ResponseDisp  string `json:"response_content_disposition"`
}
type downloadResp struct{ URL string `json:"url"` }

func (s *PresignServer) download(w http.ResponseWriter, r *http.Request) {
	var in downloadReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, err.Error(), 400); return
	}
	ctx := context.Background()
	u, err := s.P.PresignGET(ctx, in.Bucket, in.Key, time.Duration(in.TTLSeconds)*time.Second, in.ResponseCT, in.ResponseDisp)
	if err != nil {
		http.Error(w, err.Error(), 500); return
	}
	json.NewEncoder(w).Encode(downloadResp{URL: u.String()})
}

type chunkReq struct {
	Bucket      string `json:"bucket"`
	BaseKey     string `json:"base_key"`
	Part        int    `json:"part"`
	ContentType string `json:"content_type"`
	TTLSeconds  int    `json:"ttl_seconds"`
}
type chunkResp struct {
	ChunkKey string            `json:"chunk_key"`
	URL      string            `json:"url"`
	Headers  map[string]string `json:"headers"`
}

func (s *PresignServer) chunk(w http.ResponseWriter, r *http.Request) {
	var in chunkReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, err.Error(), 400); return
	}
	if in.Part <= 0 {
		http.Error(w, "part must be >= 1", 400); return
	}
	ctx := context.Background()
	u, ck, err := s.P.PresignChunkPUT(ctx, in.Bucket, in.BaseKey, in.Part, time.Duration(in.TTLSeconds)*time.Second, in.ContentType)
	if err != nil {
		http.Error(w, err.Error(), 500); return
	}
	json.NewEncoder(w).Encode(chunkResp{ChunkKey: ck, URL: u.URL.String(), Headers: u.Headers})
}

type composeReq struct {
	Bucket      string `json:"bucket"`
	BaseKey     string `json:"base_key"`
	TotalParts  int    `json:"total_parts"`
	ContentType string `json:"content_type"`
}
type composeResp struct {
	ObjectKey string `json:"object_key"`
}

func (s *PresignServer) compose(w http.ResponseWriter, r *http.Request) {
	var in composeReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, err.Error(), 400); return
	}
	ctx := context.Background()
	key, err := s.P.ComposeChunks(ctx, in.Bucket, in.BaseKey, in.TotalParts, in.ContentType)
	if err != nil {
		http.Error(w, err.Error(), 500); return
	}
	json.NewEncoder(w).Encode(composeResp{ObjectKey: key})
}

/path/cmd/presign-service/main.go

package main

import (
	"log"
	"net/http"
	"os"

	"your/module/internal/httpx"
	"your/module/internal/presign"
)

func main() {
	ps, err := presign.NewFromEnv()
	if err != nil {
		log.Fatal(err)
	}
	mux := http.NewServeMux()
	httpx.PresignServer{P: ps}.Register(mux)

	addr := os.Getenv("PRESIGN_ADDR")
	if addr == "" { addr = ":8080" }

	log.Printf("presign service listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}


⸻

3) Docker Compose wiring (sidecar-style)

Use the same environment you already use to talk to MinIO from your Go services. Path-style works fine for MinIO behind a gateway or on host networking.

S3_SECURE=true if you terminate TLS in MinIO or a fronting proxy.

/docker/compose/docker-compose.presign.yaml

services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: ${S3_ACCESS_KEY:-minioadmin}
      MINIO_ROOT_PASSWORD: ${S3_SECRET_KEY:-minioadmin}
    volumes:
      - minio-data:/data

  presign:
    build:
      context: .
      dockerfile: docker/presign/Dockerfile
    image: cdaprod/presign:latest
    depends_on: [minio]
    environment:
      S3_ENDPOINT: ${S3_ENDPOINT:-minio:9000}
      S3_SECURE: "${S3_SECURE:-false}"
      S3_ACCESS_KEY: ${S3_ACCESS_KEY:-minioadmin}
      S3_SECRET_KEY: ${S3_SECRET_KEY:-minioadmin}
      S3_BUCKET: ${S3_BUCKET:-thatdam}
      PRESIGN_DEFAULT_TTL: "15m"
      PRESIGN_MAX_TTL: "12h"
      PRESIGN_ADDR: ":8080"
    ports: ["8080:8080"]

volumes:
  minio-data: {}

/docker/presign/Dockerfile

# tiny Go presign service
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/presign ./cmd/presign-service

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app
COPY --from=build /out/presign /usr/local/bin/presign
EXPOSE 8080
USER nonroot
ENTRYPOINT ["/usr/local/bin/presign"]


⸻

4) Usage Examples

Direct browser upload (single-part)

/docs/snippets/js/put-upload.js

async function uploadFile(file) {
  // 1) ask your API for a PUT URL
  const res = await fetch("/presign/upload", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      bucket: "thatdam",
      key: `uploads/${crypto.randomUUID()}-${file.name}`,
      content_type: file.type,
      ttl_seconds: 900
    })
  });
  const { url, headers } = await res.json();

  // 2) PUT the file directly to MinIO
  const putRes = await fetch(url, { method: "PUT", headers, body: file });
  if (!putRes.ok) throw new Error("upload failed: " + putRes.status);

  return { objectKey: new URL(url).pathname.replace(/^\/thatdam\//, "") };
}

Chunked upload (Compose pattern)

/docs/snippets/js/chunked-upload.js

async function uploadChunks(file, baseKey, chunkSize=64*1024*1024) {
  const parts = Math.ceil(file.size / chunkSize);
  for (let i=1; i<=parts; i++) {
    const start = (i-1)*chunkSize, end = Math.min(i*chunkSize, file.size);
    const chunk = file.slice(start, end);

    const r = await fetch("/presign/chunk", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        bucket: "thatdam",
        base_key: baseKey,
        part: i,
        content_type: "application/octet-stream",
        ttl_seconds: 1800
      })
    });
    const { url, headers } = await r.json();
    const putRes = await fetch(url, { method: "PUT", headers, body: chunk });
    if (!putRes.ok) throw new Error("chunk "+i+" failed");
  }
  // finalize
  await fetch("/presign/compose", {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      bucket: "thatdam",
      base_key: baseKey,
      total_parts: parts,
      content_type: file.type || "application/octet-stream"
    })
  });
}

Temporary download

# Request a time-limited GET URL for inline viewing
curl -s http://localhost:8080/presign/download \
  -H 'content-type: application/json' \
  -d '{"bucket":"thatdam","key":"uploads/foo.mp4","ttl_seconds":600,"response_content_type":"video/mp4","response_content_disposition":"inline; filename=foo.mp4"}'


⸻

Notes & Best Practices
	•	TTL guardrails: Keep presigns short (minutes). Rotate MinIO access keys to invalidate leaked presigns.
	•	CORS: If the browser directly PUTs to MinIO, configure MinIO CORS for your origins. (Simple mc admin config set browser cors or via env file.)
	•	Content-Type: For PUTs, the browser must send the same Content-Type you intend to store; S3 signatures don’t pin it for PUT (we return the header to enforce it).
	•	Path-style vs VHost-style: MinIO + gateway commonly use path-style; minio-go handles both.
	•	Large files: Prefer Compose if you control both ends and want simple client logic without a custom SigV4 UploadPart signer. If you need AWS-compatible Multipart Upload with presigned parts, say the word and I’ll drop in a small SigV4 UploadPart presigner (still no aws/boto3).

⸻

If you want, I’ll adapt these exact files into your ThatDAMToolbox layout (e.g., under host/services/{api|gateway} and with your logging/config patterns), and add a quick mc job to create thatdam bucket on boot.