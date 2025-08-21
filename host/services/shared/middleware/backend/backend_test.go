package backend

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
)

// Test that RequestLoggingMiddleware includes tenant_id in log output and context.
func TestRequestLoggingMiddlewareAddsTenant(t *testing.T) {
	buf := &bytes.Buffer{}
	logx.Init(logx.Config{Service: "test", Writer: buf, Format: "json"})

	handler := RequestLoggingMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := logx.FromContext(r.Context())
		logger.Info("inside")
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/foo", nil)
	req.Header.Set("X-Tenant-ID", "acme")
	req.Header.Set("X-Principal-ID", "u1")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if got := buf.String(); !bytes.Contains([]byte(got), []byte("\"tenant_id\":\"acme\"")) {
		t.Fatalf("log missing tenant_id: %s", got)
	}
}
