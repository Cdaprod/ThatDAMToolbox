package ingest

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"path"
	"strings"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
)

// HashKey returns the canonical blob path for b's SHA-256 hash.
// Example:
//
//	key := HashKey([]byte("hello")) // blobs/sha256/2c/f2/2cf24dba5fb0a...
func HashKey(b []byte) string {
	sum := sha256.Sum256(b)
	hexh := hex.EncodeToString(sum[:])
	return path.Join("blobs", "sha256", hexh[:2], hexh[2:4], hexh)
}

// DerivedKey deterministically derives a blob path from srcHash, kind and params.
// Example:
//
//	key := DerivedKey(srcHash, "thumb", "w=320")
func DerivedKey(srcHash, kind, params string) string {
	sum := sha256.Sum256([]byte(srcHash + "|" + kind + "|" + params))
	hexh := hex.EncodeToString(sum[:])
	return path.Join("derived", kind, hexh[:2], hexh[2:4], hexh)
}

// PutIfAbsent stores the content from r under its content-addressed key.
// Returns the final key, hex hash, whether it already existed, and any error.
// Example:
//
//	key, hash, existed, err := PutIfAbsent(bs, strings.NewReader("data"))
//	if err != nil { return err }
//	fmt.Println(key, existed)
func PutIfAbsent(bs storage.BlobStore, r io.Reader) (key, hexh string, existed bool, err error) {
	tmpKey := fmt.Sprintf("tmp/%d", time.Now().UnixNano())
	h := sha256.New()
	pr, pw := io.Pipe()
	go func() {
		_, _ = io.Copy(io.MultiWriter(pw, h), r)
		pw.Close()
	}()
	if err = bs.Put(tmpKey, pr); err != nil {
		return "", "", false, err
	}
	hexh = hex.EncodeToString(h.Sum(nil))
	key = path.Join("blobs", "sha256", hexh[:2], hexh[2:4], hexh)
	if ok, _ := bs.Exists(key); ok {
		_ = bs.Delete(tmpKey)
		return key, hexh, true, nil
	}
	rd, err := bs.Get(tmpKey)
	if err != nil {
		_ = bs.Delete(tmpKey)
		return "", "", false, err
	}
	defer rd.Close()
	if err = bs.Put(key, rd); err != nil {
		_ = bs.Delete(tmpKey)
		return "", "", false, err
	}
	_ = bs.Delete(tmpKey)
	return key, hexh, false, nil
}

// WriteIndex writes a tiny sidecar index for the given hash.
// The index is a JSON blob recording the provided duration seconds.
func WriteIndex(bs storage.BlobStore, hash string, duration float64) (string, error) {
	key := path.Join("indexes", hash+".json")
	data := fmt.Sprintf("{\"duration\":%.2f}", duration)
	if err := bs.Put(key, io.NopCloser(strings.NewReader(data))); err != nil {
		return "", err
	}
	return key, nil
}
