// /host/services/shared/middleware/types.go
package middleware

import (
    "compress/gzip"
    "io"
    "net/http"
)

// User represents an authenticated user
type User struct {
    ID       string `json:"id"`
    Username string `json:"username"`
    Role     string `json:"role"`
}

// Response recorder for logging
type responseRecorder struct {
    http.ResponseWriter
    statusCode int
}

func (r *responseRecorder) WriteHeader(code int) {
    r.statusCode = code
    r.ResponseWriter.WriteHeader(code)
}

// Cache entry structure
type cacheEntry struct {
    body        []byte
    contentType string
    statusCode  int
    timestamp   time.Time
}

// Cache recorder for caching middleware
type cacheRecorder struct {
    http.ResponseWriter
    body       []byte
    statusCode int
}

func (r *cacheRecorder) Write(data []byte) (int, error) {
    r.body = append(r.body, data...)
    return r.ResponseWriter.Write(data)
}

func (r *cacheRecorder) WriteHeader(code int) {
    r.statusCode = code
    r.ResponseWriter.WriteHeader(code)
}

// Gzip response writer
type gzipResponseWriter struct {
    http.ResponseWriter
    writer *gzip.Writer
}

func (g *gzipResponseWriter) Write(data []byte) (int, error) {
    if g.writer == nil {
        g.writer = gzip.NewWriter(g.ResponseWriter)
    }
    return g.writer.Write(data)
}

func (g *gzipResponseWriter) Close() error {
    if g.writer != nil {
        return g.writer.Close()
    }
    return nil
}