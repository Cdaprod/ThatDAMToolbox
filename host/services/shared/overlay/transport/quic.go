package transport

// Package transport provides QUIC dial helpers for overlay clients.
//
// Example:
//
//  conn, err := transport.Dial(ctx, "overlay-hub:8090")
//  if err != nil { log.Fatal(err) }
//  defer conn.CloseWithError(0, "")
//
// The connection uses ALPN "overlay-quic" and skips certificate verification
// for local development. Use proper TLS verification in production.

import (
	"context"
	"crypto/tls"
	"time"

	quic "github.com/quic-go/quic-go"
)

// Dial establishes a QUIC connection to addr using the overlay ALPN.
func Dial(ctx context.Context, addr string) (quic.Connection, error) {
	tlsConf := &tls.Config{InsecureSkipVerify: true, NextProtos: []string{"overlay-quic"}}
	cfg := &quic.Config{HandshakeIdleTimeout: 5 * time.Second}
	return quic.DialAddr(ctx, addr, tlsConf, cfg)
}

// OpenStream dials addr and opens a bidirectional stream.
func OpenStream(ctx context.Context, addr string) (quic.Connection, quic.Stream, error) {
	conn, err := Dial(ctx, addr)
	if err != nil {
		return nil, nil, err
	}
	stream, err := conn.OpenStreamSync(ctx)
	if err != nil {
		conn.CloseWithError(0, "")
		return nil, nil, err
	}
	return conn, stream, nil
}
