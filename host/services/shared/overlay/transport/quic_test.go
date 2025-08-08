package transport

import (
	"context"
	"crypto/tls"
	"testing"
	"time"

	quic "github.com/quic-go/quic-go"
)

// TestDial ensures the Dial helper establishes a connection to a local server.
func TestDial(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	tlsConf := generateTLSConfig()
	listener, err := quic.ListenAddr("127.0.0.1:0", tlsConf, &quic.Config{Allow0RTT: true})
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer listener.Close()

	done := make(chan struct{})
	go func() {
		conn, err := listener.Accept(ctx)
		if err == nil {
			conn.CloseWithError(0, "")
		}
		close(done)
	}()

	if _, err := Dial(ctx, listener.Addr().String()); err != nil {
		t.Fatalf("dial: %v", err)
	}
	<-done
}

// generateTLSConfig creates an ephemeral TLS config for testing.
func generateTLSConfig() *tls.Config {
	cert, _ := tls.X509KeyPair(testCert, testKey)
	return &tls.Config{Certificates: []tls.Certificate{cert}, NextProtos: []string{"overlay-quic"}}
}

var testCert = []byte(`-----BEGIN CERTIFICATE-----
MIIBaDCCAQ6gAwIBAgIRAJ5Z/HXXIQK5vCk1vZ1tcUEwCgYIKoZIzj0EAwIwEzER
MA8GA1UEAwwIdGVzdC1jYTAeFw0yNTAxMDEwMDAwMDBaFw0yNjAxMDEwMDAwMDBa
MBMxETAPBgNVBAMMCHRlc3QtY2EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAARv
JuPqrs9jwELyhl725LLJoPLt114F8CbnMD4HzyBbs6k8ZZrVSu2Ce279b9Ec/WWy
JeayQMZT6ZX0hgqP/d9Xo0UwQzAOBgNVHQ8BAf8EBAMCAqQwDwYDVR0TAQH/BAUw
AwEB/zAdBgNVHQ4EFgQUL7Ez+KJ0C5EvhczHxVn9Yx8uWbUwCgYIKoZIzj0EAwID
SAAwRQIhAIU3F4iAfDdc0AGJi/7luWGINuD/7++UZ5EONosFVJeNAiA+G1x3rgI+
6sMsXYiwppNigK4USsfx8bVsgcuyo6edFw==
-----END CERTIFICATE-----`)

var testKey = []byte(`-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIA3aMcMBXNIN1qNbfXDnpa9eKJeNEqXWiwxupCSvJzpuoAoGCCqGSM49
AwEHoUQDQgAEbybj6q7PY8BC8oZeuOSyyaDy7ddeBfAm5zA+B88gW7OpPGWa1Urt
gntu/W/RHP1lsiXmskDGU+mV9IYKj/3fVw==
-----END EC PRIVATE KEY-----`)
