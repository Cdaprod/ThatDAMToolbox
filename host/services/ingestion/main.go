package main

// ingest-agent scans a directory, builds chunked file manifests and prints them.
//
// Usage:
//   ingest-agent -root /path/to/files [-workers 4] [-chunk 4194304]
//
// Example:
//   go run . -root ./sampledata
//
// The agent walks files under the root path concurrently and outputs a JSON
// manifest per file. Each manifest describes fixed-size SHA-256 chunks which
// can be compared or uploaded to a coordinator service.

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

// Chunk describes a piece of a file.
type Chunk struct {
	Index int    `json:"index"`
	Size  int64  `json:"size"`
	Hash  string `json:"hash"`
}

// FileManifest lists chunk metadata for a file.
type FileManifest struct {
	Path     string  `json:"path"`
	Size     int64   `json:"size"`
	MTime    int64   `json:"mtime_unix"`
	Chunks   []Chunk `json:"chunks"`
	RootHash string  `json:"root_hash"`
}

func main() {
	var root string
	var workers int
	var chunkSize int
	flag.StringVar(&root, "root", ".", "root path to scan")
	flag.IntVar(&workers, "workers", 4, "number of concurrent file workers")
	flag.IntVar(&chunkSize, "chunk", 4<<20, "chunk size in bytes")
	flag.Parse()

	if err := scan(root, chunkSize, workers); err != nil {
		fmt.Fprintf(os.Stderr, "scan error: %v\n", err)
		os.Exit(1)
	}
}

// scan walks the root directory and processes files using a worker pool.
func scan(root string, chunkSize, workers int) error {
	paths := make(chan string)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for p := range paths {
				m, err := buildManifest(p, chunkSize)
				if err != nil {
					fmt.Fprintf(os.Stderr, "manifest error: %s: %v\n", p, err)
					continue
				}
				b, _ := json.Marshal(m)
				fmt.Println(string(b))
			}
		}()
	}

	err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		paths <- path
		return nil
	})
	close(paths)
	wg.Wait()
	return err
}

// buildManifest reads the file at path and returns a manifest of its chunks.
func buildManifest(path string, chunkSize int) (*FileManifest, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	fi, err := f.Stat()
	if err != nil {
		return nil, err
	}
	size := fi.Size()
	mtime := fi.ModTime().Unix()

	chunks := make([]Chunk, 0)
	fileHash := sha256.New()
	buf := make([]byte, chunkSize)
	var off int64
	idx := 0
	for off < size {
		n := chunkSize
		if off+int64(n) > size {
			n = int(size - off)
		}
		if _, err := io.ReadFull(f, buf[:n]); err != nil {
			return nil, err
		}
		fileHash.Write(buf[:n])
		sum := sha256.Sum256(buf[:n])
		chunks = append(chunks, Chunk{Index: idx, Size: int64(n), Hash: hex.EncodeToString(sum[:])})
		idx++
		off += int64(n)
	}
	rootHash := hex.EncodeToString(fileHash.Sum(nil))
	return &FileManifest{
		Path:     path,
		Size:     size,
		MTime:    mtime,
		Chunks:   chunks,
		RootHash: rootHash,
	}, nil
}
